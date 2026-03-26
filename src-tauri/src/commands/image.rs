use crate::image::{ImageProcessor, PoseVisualizer};
use crate::models::PoseData;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessImageRequest {
    pub image_data: String,
    pub operations: Vec<ImageOperation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ImageOperation {
    Crop {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    Rotate {
        degrees: f32,
    },
    Brightness {
        factor: f32,
    },
    Contrast {
        factor: f32,
    },
    Resize {
        width: u32,
        height: u32,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessImageResponse {
    pub image_data: String,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn process_image(request: ProcessImageRequest) -> Result<ProcessImageResponse, String> {
    let processor = ImageProcessor::new();

    let mut image = processor
        .decode_from_base64(&request.image_data)
        .map_err(|e| e.to_string())?;

    for operation in request.operations {
        image = match operation {
            ImageOperation::Crop {
                x,
                y,
                width,
                height,
            } => processor
                .crop(&image, x, y, width, height)
                .map_err(|e| e.to_string())?,
            ImageOperation::Rotate { degrees } => processor
                .rotate(&image, degrees)
                .map_err(|e| e.to_string())?,
            ImageOperation::Brightness { factor } => processor
                .adjust_brightness(&image, factor)
                .map_err(|e| e.to_string())?,
            ImageOperation::Contrast { factor } => processor
                .adjust_contrast(&image, factor)
                .map_err(|e| e.to_string())?,
            ImageOperation::Resize { width, height } => processor
                .resize(&image, width, height)
                .map_err(|e| e.to_string())?,
        };
    }

    let width = image.width();
    let height = image.height();
    let image_data = processor
        .encode_to_base64(&image)
        .map_err(|e| e.to_string())?;

    Ok(ProcessImageResponse {
        image_data,
        width,
        height,
    })
}

#[tauri::command]
pub async fn draw_pose_on_image(image_data: String, pose_data: PoseData) -> Result<String, String> {
    let processor = ImageProcessor::new();
    let visualizer = PoseVisualizer::new();

    let image = processor
        .decode_from_base64(&image_data)
        .map_err(|e| e.to_string())?;

    let annotated = visualizer
        .draw_keypoints(&image, &pose_data)
        .map_err(|e| e.to_string())?;

    processor
        .encode_to_base64(&annotated)
        .map_err(|e| e.to_string())
}
