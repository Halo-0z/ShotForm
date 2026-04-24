use crate::models::{Keypoint, PoseData};
use anyhow::Result;
use image::{DynamicImage, ImageFormat, RgbImage};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct PoseDetector {
    python_path: String,
    script_path: String,
    video_script_path: String,
}

#[derive(serde::Deserialize)]
struct PythonPoseResult {
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

impl PoseDetector {
    pub fn new() -> Self {
        let python_path = Self::find_python_path();
        let script_path = Self::find_script_path();
        let video_script_path = Self::find_video_script_path();

        Self {
            python_path,
            script_path,
            video_script_path,
        }
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
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("pose_input_{}.txt", uuid::Uuid::new_v4()));

        fs::write(&temp_file, image_base64)?;

        let result = self.run_python_with_file(&temp_file);

        let _ = fs::remove_file(&temp_file);

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
            keypoints,
            width: result.width,
            height: result.height,
        })
    }

    pub fn detect_from_file(&self, file_path: &str) -> Result<PoseData> {
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
            let payload = fs::read_to_string(&output_path)?;
            let _ = fs::remove_file(&output_path);
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

impl Default for PoseDetector {
    fn default() -> Self {
        Self::new()
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
    use super::encode_rgb_image_to_base64;

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
