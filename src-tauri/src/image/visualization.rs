use crate::models::PoseData;
use anyhow::Result;
use image::{DynamicImage, ImageBuffer, Rgba};

pub struct PoseVisualizer;

impl PoseVisualizer {
    pub fn new() -> Self {
        Self
    }

    pub fn draw_keypoints(
        &self,
        image: &DynamicImage,
        pose_data: &PoseData,
    ) -> Result<DynamicImage> {
        let mut img = image.to_rgba8();

        let scale_x = image.width() as f32 / pose_data.width as f32;
        let scale_y = image.height() as f32 / pose_data.height as f32;
        let min_dimension = image.width().min(image.height()) as f32;
        let line_width = ((min_dimension / 240.0).round() as i32).clamp(3, 7);
        let point_radius = ((min_dimension / 150.0).round() as i32).clamp(5, 10);
        let emphasis_radius = point_radius + 2;

        let connections = [
            (11, 12),
            (11, 13),
            (13, 15),
            (12, 14),
            (14, 16),
            (11, 23),
            (12, 24),
            (23, 24),
            (23, 25),
            (25, 27),
            (24, 26),
            (26, 28),
            (27, 29),
            (27, 31),
            (28, 30),
            (28, 32),
        ];

        for (start_id, end_id) in connections {
            let start_kp = pose_data.keypoints.iter().find(|k| k.id == start_id);
            let end_kp = pose_data.keypoints.iter().find(|k| k.id == end_id);

            if let (Some(start), Some(end)) = (start_kp, end_kp) {
                let min_visibility =
                    if Self::is_lower_body_joint(start.id) || Self::is_lower_body_joint(end.id) {
                        0.7
                    } else {
                        0.5
                    };

                if start.visibility > min_visibility && end.visibility > min_visibility {
                    let x0 = (start.x * scale_x) as i32;
                    let y0 = (start.y * scale_y) as i32;
                    let x1 = (end.x * scale_x) as i32;
                    let y1 = (end.y * scale_y) as i32;

                    self.draw_line(
                        &mut img,
                        x0,
                        y0,
                        x1,
                        y1,
                        line_width + 3,
                        Rgba([255, 255, 255, 160]),
                    );
                    self.draw_line(
                        &mut img,
                        x0,
                        y0,
                        x1,
                        y1,
                        line_width,
                        Rgba([32, 226, 124, 235]),
                    );
                }
            }
        }

        for keypoint in &pose_data.keypoints {
            let min_visibility = if Self::is_lower_body_joint(keypoint.id) {
                0.7
            } else {
                0.5
            };

            if keypoint.visibility > min_visibility {
                let x = (keypoint.x * scale_x) as i32;
                let y = (keypoint.y * scale_y) as i32;
                let is_focus_joint = Self::is_focus_joint(keypoint.id);
                let inner_radius = if is_focus_joint {
                    emphasis_radius
                } else {
                    point_radius
                };
                let point_color = if is_focus_joint {
                    Rgba([255, 187, 0, 245])
                } else {
                    Rgba([255, 78, 78, 235])
                };

                self.draw_circle(&mut img, x, y, inner_radius + 2, Rgba([255, 255, 255, 190]));
                self.draw_circle(&mut img, x, y, inner_radius, point_color);
            }
        }

        Ok(DynamicImage::ImageRgba8(img))
    }

    fn is_focus_joint(id: u32) -> bool {
        matches!(
            id,
            11 | 12 | 13 | 14 | 15 | 16 | 23 | 24 | 25 | 26 | 27 | 28
        )
    }

    fn is_lower_body_joint(id: u32) -> bool {
        matches!(id, 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32)
    }

    fn blend_pixel(
        &self,
        img: &mut ImageBuffer<Rgba<u8>, Vec<u8>>,
        x: i32,
        y: i32,
        color: Rgba<u8>,
    ) {
        if x < 0 || y < 0 {
            return;
        }

        if let Some(pixel) = img.get_pixel_mut_checked(x as u32, y as u32) {
            let alpha = color.0[3] as f32 / 255.0;
            let inv_alpha = 1.0 - alpha;

            for channel in 0..3 {
                pixel.0[channel] = ((pixel.0[channel] as f32 * inv_alpha)
                    + (color.0[channel] as f32 * alpha))
                    .round() as u8;
            }
            pixel.0[3] = 255;
        }
    }

    fn draw_line(
        &self,
        img: &mut ImageBuffer<Rgba<u8>, Vec<u8>>,
        x0: i32,
        y0: i32,
        x1: i32,
        y1: i32,
        thickness: i32,
        color: Rgba<u8>,
    ) {
        let dx = (x1 - x0).abs();
        let dy = -(y1 - y0).abs();
        let sx = if x0 < x1 { 1 } else { -1 };
        let sy = if y0 < y1 { 1 } else { -1 };
        let mut err = dx + dy;
        let mut x = x0;
        let mut y = y0;
        let brush_radius = (thickness.max(1) + 1) / 2;

        loop {
            self.draw_circle(img, x, y, brush_radius, color);

            if x == x1 && y == y1 {
                break;
            }

            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
    }

    fn draw_circle(
        &self,
        img: &mut ImageBuffer<Rgba<u8>, Vec<u8>>,
        cx: i32,
        cy: i32,
        radius: i32,
        color: Rgba<u8>,
    ) {
        for y in -radius..=radius {
            for x in -radius..=radius {
                if x * x + y * y <= radius * radius {
                    self.blend_pixel(img, cx + x, cy + y, color);
                }
            }
        }
    }

    pub fn draw_comparison(
        &self,
        user_image: &DynamicImage,
        user_pose: &PoseData,
        player_pose: &PoseData,
    ) -> Result<DynamicImage> {
        let mut img = user_image.to_rgba8();

        let scale_x = user_image.width() as f32 / user_pose.width as f32;
        let scale_y = user_image.height() as f32 / user_pose.height as f32;

        for keypoint in &user_pose.keypoints {
            if keypoint.visibility > 0.5 {
                let x = (keypoint.x * scale_x) as i32;
                let y = (keypoint.y * scale_y) as i32;
                self.draw_circle(&mut img, x, y, 7, Rgba([42, 136, 255, 235]));
            }
        }

        for keypoint in &player_pose.keypoints {
            if keypoint.visibility > 0.5 {
                let x = (keypoint.x * scale_x) as i32;
                let y = (keypoint.y * scale_y) as i32;
                self.draw_circle(&mut img, x, y, 5, Rgba([255, 170, 0, 220]));
            }
        }

        Ok(DynamicImage::ImageRgba8(img))
    }
}

impl Default for PoseVisualizer {
    fn default() -> Self {
        Self::new()
    }
}
