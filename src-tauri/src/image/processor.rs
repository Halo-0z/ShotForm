use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageBuffer, Rgba};

pub struct ImageProcessor;

impl ImageProcessor {
    pub fn new() -> Self {
        Self
    }

    pub fn decode_from_base64(&self, base64_data: &str) -> Result<DynamicImage> {
        let base64_data = base64_data
            .strip_prefix("data:image/jpeg;base64,")
            .or_else(|| base64_data.strip_prefix("data:image/png;base64,"))
            .or_else(|| base64_data.strip_prefix("data:image/jpg;base64,"))
            .unwrap_or(base64_data);

        let decoded = general_purpose::STANDARD.decode(base64_data)?;
        let image = image::load_from_memory(&decoded)?;

        Ok(image)
    }

    pub fn encode_to_base64(&self, image: &DynamicImage) -> Result<String> {
        let mut buffer = Vec::new();
        image.write_to(
            &mut std::io::Cursor::new(&mut buffer),
            image::ImageFormat::Png,
        )?;
        let base64_str = general_purpose::STANDARD.encode(&buffer);
        Ok(format!("data:image/png;base64,{}", base64_str))
    }

    pub fn crop(
        &self,
        image: &DynamicImage,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> Result<DynamicImage> {
        let cropped = image.crop_imm(x, y, width, height);
        Ok(cropped)
    }

    pub fn rotate(&self, image: &DynamicImage, degrees: f32) -> Result<DynamicImage> {
        let rotated = match degrees as i32 {
            90 => image.rotate90(),
            180 => image.rotate180(),
            270 => image.rotate270(),
            _ => image.clone(),
        };
        Ok(rotated)
    }

    pub fn adjust_brightness(&self, image: &DynamicImage, factor: f32) -> Result<DynamicImage> {
        let mut img = image.to_rgba8();

        for pixel in img.pixels_mut() {
            pixel.0[0] = (pixel.0[0] as f32 * factor).min(255.0) as u8;
            pixel.0[1] = (pixel.0[1] as f32 * factor).min(255.0) as u8;
            pixel.0[2] = (pixel.0[2] as f32 * factor).min(255.0) as u8;
        }

        Ok(DynamicImage::ImageRgba8(img))
    }

    pub fn adjust_contrast(&self, image: &DynamicImage, factor: f32) -> Result<DynamicImage> {
        let img = image.adjust_contrast(factor);
        Ok(img)
    }

    pub fn resize(&self, image: &DynamicImage, width: u32, height: u32) -> Result<DynamicImage> {
        let resized = image.resize(width, height, image::imageops::FilterType::Lanczos3);
        Ok(resized)
    }
}

impl Default for ImageProcessor {
    fn default() -> Self {
        Self::new()
    }
}

pub fn create_rgba_image(width: u32, height: u32) -> ImageBuffer<Rgba<u8>, Vec<u8>> {
    ImageBuffer::new(width, height)
}
