use std::path::Path;

fn main() {
    // Check if icon exists before building Windows resource
    let icon_path = Path::new("icons/icon.ico");
    if icon_path.exists() {
        tauri_build::build();
    } else {
        println!("cargo:warning=icon.ico not found, skipping Windows resource generation");
        // Build without Windows resource
        tauri_build::try_build(
            tauri_build::Attributes::new()
                .windows_attributes(tauri_build::WindowsAttributes::new())
        ).expect("failed to build tauri app");
    }
}
