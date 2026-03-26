use crate::models::PoseData;
use crate::pose::PoseDetector;
use std::sync::Mutex;
use tauri::State;

pub struct DetectorState(pub Mutex<PoseDetector>);

#[tauri::command]
pub async fn detect_pose(
    image_data: String,
    detector: State<'_, DetectorState>,
) -> Result<PoseData, String> {
    let processor = crate::image::ImageProcessor::new();

    let image = processor
        .decode_from_base64(&image_data)
        .map_err(|e| e.to_string())?;

    let width = image.width();
    let height = image.height();

    let image_bytes: Vec<u8> = image.to_rgb8().to_vec();

    let pose_data = {
        let detector = detector.0.lock().map_err(|_| "Failed to lock detector")?;
        detector
            .detect(&image_bytes, width, height)
            .map_err(|e| e.to_string())?
    };

    Ok(pose_data)
}

#[tauri::command]
pub async fn initialize_detector(
    model_path: Option<String>,
    detector: State<'_, DetectorState>,
) -> Result<(), String> {
    let mut detector = detector.0.lock().map_err(|_| "Failed to lock detector")?;

    if let Some(path) = model_path {
        detector.load_model(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
