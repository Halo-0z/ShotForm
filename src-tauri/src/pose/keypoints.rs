pub const NOSE: u32 = 0;
pub const LEFT_EYE_INNER: u32 = 1;
pub const LEFT_EYE: u32 = 2;
pub const LEFT_EYE_OUTER: u32 = 3;
pub const RIGHT_EYE_INNER: u32 = 4;
pub const RIGHT_EYE: u32 = 5;
pub const RIGHT_EYE_OUTER: u32 = 6;
pub const LEFT_EAR: u32 = 7;
pub const RIGHT_EAR: u32 = 8;
pub const MOUTH_LEFT: u32 = 9;
pub const MOUTH_RIGHT: u32 = 10;
pub const LEFT_SHOULDER: u32 = 11;
pub const RIGHT_SHOULDER: u32 = 12;
pub const LEFT_ELBOW: u32 = 13;
pub const RIGHT_ELBOW: u32 = 14;
pub const LEFT_WRIST: u32 = 15;
pub const RIGHT_WRIST: u32 = 16;
pub const LEFT_PINKY: u32 = 17;
pub const RIGHT_PINKY: u32 = 18;
pub const LEFT_INDEX: u32 = 19;
pub const RIGHT_INDEX: u32 = 20;
pub const LEFT_THUMB: u32 = 21;
pub const RIGHT_THUMB: u32 = 22;
pub const LEFT_HIP: u32 = 23;
pub const RIGHT_HIP: u32 = 24;
pub const LEFT_KNEE: u32 = 25;
pub const RIGHT_KNEE: u32 = 26;
pub const LEFT_ANKLE: u32 = 27;
pub const RIGHT_ANKLE: u32 = 28;
pub const LEFT_HEEL: u32 = 29;
pub const RIGHT_HEEL: u32 = 30;
pub const LEFT_FOOT_INDEX: u32 = 31;
pub const RIGHT_FOOT_INDEX: u32 = 32;

pub const UPPER_BODY_CONNECTIONS: [(u32, u32); 6] = [
    (LEFT_SHOULDER, RIGHT_SHOULDER),
    (LEFT_SHOULDER, LEFT_ELBOW),
    (LEFT_ELBOW, LEFT_WRIST),
    (RIGHT_SHOULDER, RIGHT_ELBOW),
    (RIGHT_ELBOW, RIGHT_WRIST),
    (LEFT_SHOULDER, LEFT_HIP),
];

pub const LOWER_BODY_CONNECTIONS: [(u32, u32); 6] = [
    (LEFT_HIP, RIGHT_HIP),
    (LEFT_HIP, LEFT_KNEE),
    (LEFT_KNEE, LEFT_ANKLE),
    (RIGHT_HIP, RIGHT_KNEE),
    (RIGHT_KNEE, RIGHT_ANKLE),
    (RIGHT_SHOULDER, RIGHT_HIP),
];
