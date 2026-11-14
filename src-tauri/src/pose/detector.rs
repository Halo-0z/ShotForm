use crate::models::{Keypoint, PoseData};
use anyhow::Result;
use image::{DynamicImage, ImageFormat, RgbImage};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const DAEMON_READY_TIMEOUT_MS: u64 = 10000;
const DAEMON_REQUEST_TIMEOUT_MS: u64 = 15000;
const DAEMON_SHUTDOWN_TIMEOUT_MS: u64 = 2000;

#[derive(Clone, Copy)]
struct DaemonTimeouts {
    ready: Duration,
    request: Duration,
    shutdown: Duration,
}

impl Default for DaemonTimeouts {
    fn default() -> Self {
        Self {
            ready: Duration::from_millis(DAEMON_READY_TIMEOUT_MS),
            request: Duration::from_millis(DAEMON_REQUEST_TIMEOUT_MS),
            shutdown: Duration::from_millis(DAEMON_SHUTDOWN_TIMEOUT_MS),
        }
    }
}

pub struct PoseDetector {
    python_path: String,
    script_path: String,
    video_script_path: String,
    daemon: Arc<Mutex<Option<DaemonHandle>>>,
    daemon_enabled: bool,
    daemon_timeouts: DaemonTimeouts,
}

struct DaemonHandle {
    process: Child,
    requests: Option<mpsc::Sender<String>>,
    responses: Option<mpsc::Receiver<std::result::Result<String, String>>>,
    workers: Vec<thread::JoinHandle<()>>,
    timeouts: DaemonTimeouts,
    stopped: bool,
}

#[derive(serde::Deserialize)]
struct PythonPoseResult {
    #[serde(default)]
    model_info: Option<serde_json::Value>,
    keypoints: Vec<PythonKeypoint>,
    width: u32,
    height: u32,
    #[serde(default)]
    error: Option<String>,
}

#[derive(serde::Deserialize)]
struct PythonKeypoint {
    id: u32,
    name: String,
    x: f32,
    y: f32,
    z: f32,
    visibility: f32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct VideoPoseFrameResult {
    #[serde(default)]
    pub model_info: Option<serde_json::Value>,
    pub index: u32,
    pub timestamp_ms: u32,
    pub image_data: String,
    pub keypoints: Vec<Keypoint>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct MultiPoseEntry {
    pub pose_index: u32,
    pub keypoints: Vec<Keypoint>,
    pub torso_cx: f32,
    pub torso_cy: f32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct FirstFrameMultiPose {
    pub index: u32,
    pub image_data: String,
    pub poses: Vec<MultiPoseEntry>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct VideoPoseResult {
    pub frames: Vec<VideoPoseFrameResult>,
    pub width: u32,
    pub height: u32,
    pub fps: f32,
    pub duration_ms: u32,
    pub trim_start_ms: u32,
    pub trim_end_ms: u32,
    pub total_frames: u32,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub detected_pose_count: Option<u32>,
    #[serde(default)]
    pub first_frame_multi_pose: Option<FirstFrameMultiPose>,
}

impl DaemonHandle {
    fn start(python_path: &str, script_path: &str, timeouts: DaemonTimeouts) -> Result<Self> {
        let mut command = Command::new(python_path);
        command
            .arg(script_path)
            .arg("--daemon")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut process = command.spawn()?;
        // All three streams are guaranteed by Stdio::piped above.
        let mut stdin = process.stdin.take().expect("piped stdin");
        let stdout = process.stdout.take().expect("piped stdout");
        let stderr = process.stderr.take().expect("piped stderr");
        let (request_tx, request_rx) = mpsc::channel::<String>();
        let (response_tx, response_rx) = mpsc::channel();
        let write_errors = response_tx.clone();
        let writer = thread::spawn(move || {
            for request in request_rx {
                if let Err(error) = stdin
                    .write_all(request.as_bytes())
                    .and_then(|_| stdin.flush())
                {
                    let _ = write_errors.send(Err(format!("Daemon stdin failed: {error}")));
                    break;
                }
            }
        });
        let reader = thread::spawn(move || {
            let mut stdout = BufReader::new(stdout);
            loop {
                let mut line = String::new();
                let message = match stdout.read_line(&mut line) {
                    Ok(0) => Err("Daemon stdout closed before completing protocol".into()),
                    Ok(_) => Ok(line),
                    Err(error) => Err(format!("Daemon stdout failed: {error}")),
                };
                let failed = message.is_err();
                if response_tx.send(message).is_err() || failed {
                    break;
                }
            }
        });
        let diagnostics = thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[pose-daemon] {line}");
            }
        });
        Ok(Self {
            process,
            requests: Some(request_tx),
            responses: Some(response_rx),
            workers: vec![writer, reader, diagnostics],
            timeouts,
            stopped: false,
        })
    }

    fn read_response(&self, deadline: Instant, ready: bool) -> Result<String> {
        let phase = if ready { "ready signal" } else { "response" };
        let receiver = self
            .responses
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Daemon communication has been closed"))?;
        loop {
            // One absolute deadline: blank/log/status lines cannot extend the timeout.
            let remaining = deadline
                .checked_duration_since(Instant::now())
                .ok_or_else(|| anyhow::anyhow!("Timed out waiting for daemon {phase}"))?;
            let line = match receiver.recv_timeout(remaining) {
                Ok(Ok(line)) => line,
                Ok(Err(error)) => anyhow::bail!(error),
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    anyhow::bail!("Timed out waiting for daemon {phase}")
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    anyhow::bail!("Daemon response channel disconnected")
                }
            };
            if Instant::now() >= deadline {
                anyhow::bail!("Timed out waiting for daemon {phase}");
            }
            if let Ok(response) = serde_json::from_str::<serde_json::Value>(&line) {
                if ready {
                    if response.get("status").and_then(|s| s.as_str()) == Some("ready") {
                        return Ok(line);
                    }
                    if let Some(error) = response.get("error").and_then(|e| e.as_str()) {
                        anyhow::bail!("Daemon startup failed: {error}");
                    }
                } else if response.get("status").is_none() {
                    return Ok(line.trim().to_string());
                }
            }
        }
    }

    fn wait_for_ready(&mut self) -> Result<()> {
        let result = self
            .read_response(Instant::now() + self.timeouts.ready, true)
            .map(|_| ());
        if result.is_err() {
            self.stop(false);
        }
        result
    }

    fn send_request(&mut self, method: &str, payload: &str) -> Result<String> {
        // Include pipe writing in the deadline; a daemon that stops reading cannot hang us.
        let deadline = Instant::now() + self.timeouts.request;
        let result = (|| {
            let sender = self
                .requests
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Daemon communication has been closed"))?;
            sender.send(format!("{{\"method\":\"{}\",{}}}\n", method, payload))?;
            self.read_response(deadline, false)
        })();
        if result.is_err() {
            self.stop(false);
        }
        result
    }

    fn is_healthy(&mut self) -> bool {
        !self.stopped && matches!(self.process.try_wait(), Ok(None))
    }

    fn stop(&mut self, graceful: bool) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        if graceful {
            if let Some(sender) = self.requests.as_ref() {
                let _ = sender.send("{\"method\":\"shutdown\"}\n".into());
            }
        }
        // Never share a failed session's queued or late responses with a new process.
        self.requests.take();
        self.responses.take();
        let deadline = Instant::now()
            + if graceful {
                self.timeouts.shutdown
            } else {
                Duration::ZERO
            };
        loop {
            match self.process.try_wait() {
                Ok(Some(_)) => break, // try_wait also reaps the child.
                Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
                _ => {
                    match self.process.kill() {
                        Ok(()) => {
                            if let Err(error) = self.process.wait() {
                                eprintln!("[pose-daemon] failed to reap killed child: {error}");
                            }
                        }
                        Err(error) => {
                            eprintln!("[pose-daemon] kill failed: {error}");
                            let _ = self.process.try_wait();
                        }
                    }
                    break;
                }
            }
        }
        // Reaped Python closes its pipe ends. Join only finished workers so inherited
        // handles in an unexpected descendant cannot make shutdown unbounded.
        for worker in self.workers.drain(..) {
            if worker.is_finished() {
                let _ = worker.join();
            }
        }
    }

    fn shutdown(&mut self) {
        self.stop(true);
    }
}

impl Drop for DaemonHandle {
    fn drop(&mut self) {
        self.shutdown();
    }
}

impl PoseDetector {
    pub fn new() -> Self {
        let python_path = Self::find_python_path();
        let script_path = Self::find_script_path();
        let video_script_path = Self::find_video_script_path();
        let daemon_enabled = std::env::var("POSE_DETECTOR_MODE")
            .map(|v| v != "file")
            .unwrap_or(true);

        Self {
            python_path,
            script_path,
            video_script_path,
            daemon: Arc::new(Mutex::new(None)),
            daemon_enabled,
            daemon_timeouts: DaemonTimeouts::default(),
        }
    }

    pub fn ensure_daemon_started(&self) -> Result<()> {
        if !self.daemon_enabled {
            return Ok(());
        }

        let mut daemon_guard = self.daemon.lock().unwrap();
        if daemon_guard
            .as_mut()
            .is_some_and(|handle| handle.is_healthy())
        {
            return Ok(());
        }
        if let Some(mut handle) = daemon_guard.take() {
            handle.shutdown();
        }
        let mut handle =
            DaemonHandle::start(&self.python_path, &self.script_path, self.daemon_timeouts)?;
        handle.wait_for_ready()?;
        eprintln!("[pose-daemon] started successfully");
        *daemon_guard = Some(handle);
        Ok(())
    }

    fn daemon_request(&self, method: &str, payload: &str) -> Result<String> {
        let mut guard = self.daemon.lock().unwrap();
        let result = guard
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("Daemon not started"))?
            .send_request(method, payload);
        if result.is_err() {
            guard.take();
        }
        result
    }

    fn find_python_path() -> String {
        #[cfg(windows)]
        let possible_paths = vec![
            ".venv/Scripts/pythonw.exe",
            "../.venv/Scripts/pythonw.exe",
            "../../.venv/Scripts/pythonw.exe",
            ".venv/Scripts/python.exe",
            "../.venv/Scripts/python.exe",
            "../../.venv/Scripts/python.exe",
        ];

        #[cfg(not(windows))]
        let possible_paths = vec![
            ".venv/bin/python",
            "../.venv/bin/python",
            "../../.venv/bin/python",
        ];

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return path.to_string();
            }
        }

        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let project_root = std::path::Path::new(&manifest_dir).parent();
            if let Some(root) = project_root {
                #[cfg(windows)]
                let manifest_candidates = vec![
                    root.join(".venv").join("Scripts").join("pythonw.exe"),
                    root.join(".venv").join("Scripts").join("python.exe"),
                ];

                #[cfg(not(windows))]
                let manifest_candidates = vec![root.join(".venv").join("bin").join("python")];

                for candidate in manifest_candidates {
                    if candidate.exists() {
                        return candidate.to_string_lossy().to_string();
                    }
                }
            }
        }

        #[cfg(windows)]
        return "pythonw".to_string();

        #[cfg(not(windows))]
        "python".to_string()
    }

    fn find_script_path() -> String {
        let possible_paths = vec![
            "scripts/pose_detect.py",
            "../scripts/pose_detect.py",
            "../../scripts/pose_detect.py",
        ];

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return absolutize_path(path);
            }
        }

        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let project_root = std::path::Path::new(&manifest_dir)
                .parent()
                .map(|p| p.join("scripts").join("pose_detect.py"));
            if let Some(path) = project_root {
                if path.exists() {
                    return absolutize_path(path);
                }
            }
        }

        absolutize_path("scripts/pose_detect.py")
    }

    fn find_video_script_path() -> String {
        let possible_paths = vec![
            "scripts/video_pose_detect.py",
            "../scripts/video_pose_detect.py",
            "../../scripts/video_pose_detect.py",
        ];

        for path in &possible_paths {
            if std::path::Path::new(path).exists() {
                return absolutize_path(path);
            }
        }

        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let project_root = std::path::Path::new(&manifest_dir)
                .parent()
                .map(|p| p.join("scripts").join("video_pose_detect.py"));
            if let Some(path) = project_root {
                if path.exists() {
                    return absolutize_path(path);
                }
            }
        }

        absolutize_path("scripts/video_pose_detect.py")
    }

    pub fn load_model(&mut self, _model_path: &str) -> Result<()> {
        Ok(())
    }

    pub fn detect(&self, image_data: &[u8], width: u32, height: u32) -> Result<PoseData> {
        let image_base64 = encode_rgb_image_to_base64(image_data, width, height)?;
        self.detect_from_base64(&image_base64)
    }

    pub fn detect_from_base64(&self, image_base64: &str) -> Result<PoseData> {
        if self.daemon_enabled {
            match self.try_daemon_detect_base64(image_base64) {
                Ok(result) => return Ok(result),
                Err(e) => {
                    eprintln!(
                        "[pose-daemon] daemon failed, falling back to file mode: {}",
                        e
                    );
                }
            }
        }

        self.detect_from_base64_filemode(image_base64)
    }

    fn try_daemon_detect_base64(&self, image_base64: &str) -> Result<PoseData> {
        self.ensure_daemon_started()?;

        let payload = format!(
            "\"image_base64\":\"{}\"",
            image_base64.replace('\\', "\\\\").replace('"', "\\\"")
        );
        let stdout = self.daemon_request("detect_base64", &payload)?;

        let result: PythonPoseResult = serde_json::from_str(&stdout).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse daemon response: {} - Output: {}",
                e,
                stdout
            )
        })?;

        if let Some(error) = result.error {
            anyhow::bail!("Pose detection error: {}", error);
        }

        Ok(PoseData {
            model_info: result.model_info,
            keypoints: result
                .keypoints
                .into_iter()
                .map(|pk| Keypoint {
                    id: pk.id,
                    name: pk.name,
                    x: pk.x,
                    y: pk.y,
                    z: pk.z,
                    visibility: pk.visibility,
                })
                .collect(),
            width: result.width,
            height: result.height,
        })
    }

    fn detect_from_base64_filemode(&self, image_base64: &str) -> Result<PoseData> {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("pose_input_{}.txt", uuid::Uuid::new_v4()));

        std::fs::write(&temp_file, image_base64)?;
        let result = self.run_python_with_file(&temp_file);
        let _ = std::fs::remove_file(&temp_file);
        result
    }

    fn run_python_with_file(&self, input_file: &PathBuf) -> Result<PoseData> {
        ensure_script_exists(&self.script_path)?;
        let input_path = input_file.to_string_lossy().to_string();
        let mut command = build_python_command(&self.python_path, &self.script_path);
        command.arg("--input-file").arg(&input_path);
        let stdout = run_python_json_command(command)?;
        let result: PythonPoseResult = serde_json::from_str(&stdout).map_err(|e| {
            anyhow::anyhow!("Failed to parse Python output: {} - Output: {}", e, stdout)
        })?;

        if let Some(error) = result.error {
            anyhow::bail!("Pose detection error: {}", error);
        }

        let keypoints: Vec<Keypoint> = result
            .keypoints
            .into_iter()
            .map(|pk| Keypoint {
                id: pk.id,
                name: pk.name,
                x: pk.x,
                y: pk.y,
                z: pk.z,
                visibility: pk.visibility,
            })
            .collect();

        Ok(PoseData {
            model_info: result.model_info,
            keypoints,
            width: result.width,
            height: result.height,
        })
    }

    pub fn detect_from_file(&self, file_path: &str) -> Result<PoseData> {
        if self.daemon_enabled {
            match self.try_daemon_detect_file(file_path) {
                Ok(result) => return Ok(result),
                Err(e) => {
                    eprintln!(
                        "[pose-daemon] daemon failed, falling back to file mode: {}",
                        e
                    );
                }
            }
        }

        self.detect_from_file_fallback(file_path)
    }

    fn try_daemon_detect_file(&self, file_path: &str) -> Result<PoseData> {
        self.ensure_daemon_started()?;

        let escaped_path = file_path.replace('\\', "\\\\").replace('"', "\\\"");
        let payload = format!("\"file_path\":\"{}\"", escaped_path);
        let stdout = self.daemon_request("detect_file", &payload)?;

        let result: PythonPoseResult = serde_json::from_str(&stdout).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse daemon response: {} - Output: {}",
                e,
                stdout
            )
        })?;

        if let Some(error) = result.error {
            anyhow::bail!("Pose detection error: {}", error);
        }

        Ok(PoseData {
            model_info: result.model_info,
            keypoints: result
                .keypoints
                .into_iter()
                .map(|pk| Keypoint {
                    id: pk.id,
                    name: pk.name,
                    x: pk.x,
                    y: pk.y,
                    z: pk.z,
                    visibility: pk.visibility,
                })
                .collect(),
            width: result.width,
            height: result.height,
        })
    }

    fn detect_from_file_fallback(&self, file_path: &str) -> Result<PoseData> {
        ensure_script_exists(&self.script_path)?;
        let mut command = build_python_command(&self.python_path, &self.script_path);
        command.arg("--file").arg(file_path);
        let stdout = run_python_json_command(command)?;
        let result: PythonPoseResult = serde_json::from_str(&stdout)
            .map_err(|e| anyhow::anyhow!("Failed to parse Python output: {}", e))?;

        if let Some(error) = result.error {
            anyhow::bail!("Pose detection error: {}", error);
        }

        let keypoints: Vec<Keypoint> = result
            .keypoints
            .into_iter()
            .map(|pk| Keypoint {
                id: pk.id,
                name: pk.name,
                x: pk.x,
                y: pk.y,
                z: pk.z,
                visibility: pk.visibility,
            })
            .collect();

        Ok(PoseData {
            model_info: result.model_info,
            keypoints,
            width: result.width,
            height: result.height,
        })
    }

    pub fn analyze_video_file(
        &self,
        file_path: &str,
        start_ms: u32,
        end_ms: u32,
        max_frames: u32,
        subject_pose_index: Option<u32>,
    ) -> Result<VideoPoseResult> {
        ensure_script_exists(&self.video_script_path)?;
        let mut command = build_python_command(&self.python_path, &self.video_script_path);
        command
            .arg("--video")
            .arg(file_path)
            .arg("--start-ms")
            .arg(start_ms.to_string())
            .arg("--end-ms")
            .arg(end_ms.to_string())
            .arg("--max-frames")
            .arg(max_frames.to_string());

        if let Some(idx) = subject_pose_index {
            command.arg("--subject-pose-index").arg(idx.to_string());
        }

        let stdout = run_python_json_command(command)?;
        let result: VideoPoseResult = serde_json::from_str(&stdout).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse Python video output: {} - Output: {}",
                e,
                stdout
            )
        })?;

        if let Some(error) = &result.error {
            anyhow::bail!("Video pose detection error: {}", error);
        }

        Ok(result)
    }

    pub fn shutdown_daemon(&self) {
        let mut daemon_guard = self.daemon.lock().unwrap();
        if let Some(mut handle) = daemon_guard.take() {
            eprintln!("[pose-daemon] shutting down");
            handle.shutdown();
        }
    }
}

impl Drop for PoseDetector {
    fn drop(&mut self) {
        self.shutdown_daemon();
    }
}

impl Default for PoseDetector {
    fn default() -> Self {
        Self::new()
    }
}

fn absolutize_path(path: impl AsRef<Path>) -> String {
    let path = path.as_ref();
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

fn ensure_script_exists(script_path: &str) -> Result<()> {
    if Path::new(script_path).exists() {
        return Ok(());
    }

    anyhow::bail!("Python script not found: {}", script_path);
}

fn build_python_command(python_path: &str, script_path: &str) -> Command {
    let mut command = Command::new(python_path);
    command.arg(script_path);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    command
}

fn run_python_json_command(mut command: Command) -> Result<String> {
    #[cfg(windows)]
    {
        let output_path = std::env::temp_dir().join(format!(
            "basketball-shot-analyzer-{}.json",
            uuid::Uuid::new_v4()
        ));
        command.arg("--output-file").arg(&output_path);
        let output = command.output()?;

        if output_path.exists() {
            let payload = std::fs::read_to_string(&output_path)?;
            let _ = std::fs::remove_file(&output_path);
            return Ok(payload);
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        anyhow::bail!(
            "Python script finished without output file (status: {}) stderr: {} stdout: {}",
            output.status,
            stderr,
            stdout
        );
    }

    #[cfg(not(windows))]
    {
        let output = command.output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Python script failed: {}", stderr);
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

fn encode_rgb_image_to_base64(image_data: &[u8], width: u32, height: u32) -> Result<String> {
    let rgb_image = RgbImage::from_raw(width, height, image_data.to_vec())
        .ok_or_else(|| anyhow::anyhow!("Invalid RGB image buffer"))?;
    let dynamic_image = DynamicImage::ImageRgb8(rgb_image);
    let mut encoded = std::io::Cursor::new(Vec::new());
    dynamic_image.write_to(&mut encoded, ImageFormat::Png)?;

    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        encoded.into_inner(),
    ))
}

#[cfg(test)]
mod tests {
    use super::{encode_rgb_image_to_base64, DaemonHandle, PoseDetector};

    #[test]
    fn daemon_start_owns_child_and_drains_diagnostics() {
        let script =
            std::env::temp_dir().join(format!("shotform-daemon-test-{}.py", uuid::Uuid::new_v4()));
        std::fs::write(
            &script,
            r#"import sys,json
print(json.dumps({'status':'ready'}),flush=True)
for line in sys.stdin:
    request=json.loads(line)
    if request['method']=='shutdown': break
    print('diagnostic',file=sys.stderr,flush=True)
    print(json.dumps({'keypoints': [], 'width': 1, 'height': 1}),flush=True)
"#,
        )
        .unwrap();
        for _ in 0..4 {
            let mut daemon = DaemonHandle::start(
                &PoseDetector::find_python_path(),
                script.to_str().unwrap(),
                Default::default(),
            )
            .unwrap();
            daemon.wait_for_ready().unwrap();
            assert!(daemon.is_healthy());
            let result = daemon
                .send_request("detect_file", "\"file_path\":\"fixture\"")
                .unwrap();
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&result).unwrap()["width"],
                1
            );
            daemon.shutdown();
            assert!(!daemon.is_healthy());
        }
        std::fs::remove_file(script).unwrap();
    }

    struct DaemonFixture {
        directory: std::path::PathBuf,
        script: std::path::PathBuf,
    }

    impl DaemonFixture {
        fn new(code: &str) -> Self {
            let directory =
                std::env::temp_dir().join(format!("shotform-timeout-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&directory).unwrap();
            let script = directory.join("daemon.py");
            std::fs::write(&script, code).unwrap();
            Self { directory, script }
        }
        fn start(&self, timeouts: super::DaemonTimeouts) -> DaemonHandle {
            DaemonHandle::start(
                &PoseDetector::find_python_path(),
                self.script.to_str().unwrap(),
                timeouts,
            )
            .unwrap()
        }
    }
    impl Drop for DaemonFixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.directory);
        }
    }
    fn fast_timeouts() -> super::DaemonTimeouts {
        super::DaemonTimeouts {
            ready: std::time::Duration::from_secs(2),
            request: std::time::Duration::from_millis(200),
            shutdown: std::time::Duration::from_millis(200),
        }
    }
    fn assert_closed_and_reaped(daemon: &mut DaemonHandle) {
        assert!(
            daemon.process.try_wait().unwrap().is_some(),
            "child must be reaped"
        );
        assert!(daemon.requests.is_none() && daemon.responses.is_none());
        assert!(!daemon.is_healthy());
    }

    #[test]
    fn daemon_no_ready_times_out_and_reaps_child() {
        let fixture = DaemonFixture::new("import time\ntime.sleep(30)\n");
        let mut timeout = fast_timeouts();
        timeout.ready = std::time::Duration::from_millis(200);
        let mut daemon = fixture.start(timeout);
        let start = std::time::Instant::now();
        assert!(daemon
            .wait_for_ready()
            .unwrap_err()
            .to_string()
            .contains("Timed out"));
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
        assert_closed_and_reaped(&mut daemon);
    }

    #[test]
    fn daemon_no_response_including_blocked_stdin_is_bounded() {
        let fixture = DaemonFixture::new(
            "import time\nprint('{\"status\":\"ready\"}',flush=True)\ntime.sleep(30)\n",
        );
        let mut daemon = fixture.start(fast_timeouts());
        daemon.wait_for_ready().unwrap();
        let start = std::time::Instant::now();
        // Exceeds pipe capacity: the writer blocks because Python never reads stdin.
        let payload = format!("\"image_base64\":\"{}\"", "A".repeat(4 * 1024 * 1024));
        assert!(daemon
            .send_request("detect_base64", &payload)
            .unwrap_err()
            .to_string()
            .contains("Timed out"));
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
        assert_closed_and_reaped(&mut daemon);
        assert!(daemon
            .send_request("detect_file", "\"file_path\":\"next\"")
            .is_err());
    }

    #[test]
    fn daemon_ignoring_shutdown_is_killed_and_reaped() {
        let fixture = DaemonFixture::new("import sys,time\nprint('{\"status\":\"ready\"}',flush=True)\nsys.stdin.readline()\ntime.sleep(30)\n");
        let mut daemon = fixture.start(fast_timeouts());
        daemon.wait_for_ready().unwrap();
        let start = std::time::Instant::now();
        daemon.shutdown();
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
        assert_closed_and_reaped(&mut daemon);
        daemon.shutdown(); // Idempotent: no second wait or write to a dead process.
    }

    #[test]
    fn daemon_status_lines_do_not_extend_response_deadline() {
        let fixture = DaemonFixture::new(
            r#"import sys,time
print('{"status":"ready"}',flush=True)
sys.stdin.readline()
while True:
    print('{"status":"working"}',flush=True)
    time.sleep(0.02)
"#,
        );
        let mut daemon = fixture.start(fast_timeouts());
        daemon.wait_for_ready().unwrap();
        let start = std::time::Instant::now();
        assert!(daemon
            .send_request("detect_file", "\"file_path\":\"test\"")
            .is_err());
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
        assert_closed_and_reaped(&mut daemon);
    }

    #[test]
    fn daemon_default_ready_deadline_rejects_twelve_second_late_ready() {
        let fixture = DaemonFixture::new(
            "import time\ntime.sleep(12)\nprint('{\"status\":\"ready\"}',flush=True)\n",
        );
        let mut daemon = fixture.start(Default::default());
        let start = std::time::Instant::now();
        assert!(daemon
            .wait_for_ready()
            .unwrap_err()
            .to_string()
            .contains("Timed out"));
        let elapsed = start.elapsed();
        eprintln!("default ready timeout elapsed: {elapsed:?}");
        assert!(elapsed >= std::time::Duration::from_secs(9));
        assert!(elapsed < std::time::Duration::from_millis(11500));
        assert_closed_and_reaped(&mut daemon);
    }

    #[test]
    fn daemon_default_request_deadline_rejects_seventeen_second_late_response() {
        let fixture = DaemonFixture::new(
            r#"import sys,time
print('{"status":"ready"}',flush=True)
sys.stdin.readline()
time.sleep(17)
print('{"keypoints":[],"width":99,"height":1}',flush=True)
"#,
        );
        let mut daemon = fixture.start(Default::default());
        daemon.wait_for_ready().unwrap();
        let start = std::time::Instant::now();
        assert!(daemon
            .send_request("detect_file", "\"file_path\":\"test\"")
            .unwrap_err()
            .to_string()
            .contains("Timed out"));
        let elapsed = start.elapsed();
        eprintln!("default request timeout elapsed: {elapsed:?}");
        assert!(elapsed >= std::time::Duration::from_secs(14));
        assert!(elapsed < std::time::Duration::from_millis(16500));
        assert_closed_and_reaped(&mut daemon);
    }

    #[test]
    fn daemon_timeout_falls_back_then_next_analysis_uses_fresh_session() {
        let fixture = DaemonFixture::new(
            r#"import sys,json,time
from pathlib import Path
marker=Path(__file__).with_suffix('.started')
if '--daemon' not in sys.argv:
    result=json.dumps({'keypoints':[],'width':3,'height':1})
    if '--output-file' in sys.argv:
        output=Path(sys.argv[sys.argv.index('--output-file')+1])
        output.write_text(result,encoding='utf-8')
    else:
        print(result,flush=True)
else:
    first=not marker.exists()
    marker.touch()
    print('{"status":"ready"}',flush=True)
    for line in sys.stdin:
        request=json.loads(line)
        if request['method']=='shutdown': break
        if first:
            time.sleep(3)
            print('{"keypoints":[],"width":99,"height":1}',flush=True)
        else:
            print('{"keypoints":[],"width":2,"height":1}',flush=True)
"#,
        );
        let mut detector = PoseDetector::new();
        detector.script_path = fixture.script.to_string_lossy().into();
        detector.daemon_enabled = true;
        detector.daemon_timeouts = fast_timeouts();
        // Exercise the public analysis path, including existing file fallback.
        assert_eq!(detector.detect_from_file("first").unwrap().width, 3);
        assert!(detector.daemon.lock().unwrap().is_none());
        assert_eq!(detector.detect_from_file("second").unwrap().width, 2);
        assert_eq!(detector.try_daemon_detect_base64("AA==").unwrap().width, 2);
        detector.shutdown_daemon();
        assert!(detector.daemon.lock().unwrap().is_none());
    }

    #[test]
    fn encodes_raw_rgb_pixels_as_decodable_png() {
        let rgb_pixels = [255_u8, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255];

        let encoded = encode_rgb_image_to_base64(&rgb_pixels, 2, 2).expect("expected png base64");
        let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
            .expect("expected valid base64");
        let image = image::load_from_memory(&decoded).expect("expected decodable image");

        assert_eq!(image.width(), 2);
        assert_eq!(image.height(), 2);
    }
}
