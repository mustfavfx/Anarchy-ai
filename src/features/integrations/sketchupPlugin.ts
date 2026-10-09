// Anarchy AI SketchUp Extension (Ruby source)
export const ANARCHY_SKETCHUP_LOADER = `# frozen_string_literal: true
# ==============================================================================
# Anarchy AI - SketchUp Extension Loader
# (c) 2026 Anarchy AI. All Rights Reserved.
# ==============================================================================

require 'sketchup.rb'
require 'extensions.rb'

module AnarchyAI
  PLUGIN_DIR = File.dirname(__FILE__) unless defined?(PLUGIN_DIR)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new('Anarchy AI', File.join(PLUGIN_DIR, 'anarchy_sketchup', 'main.rb'))
    ext.description = 'Lightning-fast AI for SketchUp. Send active viewports, trigger instant AI renders, and batch export scene tabs directly to Anarchy AI.'
    ext.version = '1.8.2'
    ext.creator = 'Anarchy AI'
    ext.copyright = '(c) 2026 Anarchy AI'

    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
`;

export const ANARCHY_SKETCHUP_MAIN = `# frozen_string_literal: true
# ==============================================================================
# Anarchy AI - Core SketchUp Extension Module
# (c) 2026 Anarchy AI. All Rights Reserved.
# ==============================================================================

require 'sketchup.rb'
require 'net/http'
require 'uri'
require 'json'
require 'base64'
require 'tmpdir'

module AnarchyAI
  VERSION = '1.8.2'.freeze
  BRIDGE_URL = 'http://127.0.0.1:14400/upload-view'.freeze
  BIM_URL = 'http://127.0.0.1:14400/agent/bim-metadata'.freeze

  def self.auth_token
    appdata = ENV['APPDATA'] || ''
    token_file = File.join(appdata, 'com.anarchyai.app', '.token')
    if File.exist?(token_file)
      File.read(token_file).strip
    else
      ''
    end
  rescue => e
    puts "[Anarchy AI] Token read warning: #{e.message}"
    ''
  end

  def self.capture_viewport_image(max_dim = 2048)
    model = Sketchup.active_model
    return nil unless model

    view = model.active_view
    return nil unless view

    w = view.vpwidth
    h = view.vpheight
    w = 1920 if w <= 0
    h = 1080 if h <= 0

    if w > max_dim || h > max_dim
      ratio = [max_dim.to_f / w, max_dim.to_f / h].min
      w = (w * ratio).round
      h = (h * ratio).round
    end

    temp_path = File.join(Dir.tmpdir, "anarchy_su_#{Time.now.to_i}_#{rand(1000)}.jpg")

    options = {
      filename: temp_path,
      width: w,
      height: h,
      antialias: true,
      compression: 0.92,
      transparent: false
    }

    success = false
    begin
      success = view.write_image(options)
    rescue => _e
      begin
        success = view.write_image(temp_path, w, h, true, 0.92)
      rescue => _e2
        success = false
      end
    end

    if success && File.exist?(temp_path) && File.size(temp_path) > 0
      temp_path
    else
      nil
    end
  end

  def self.post_image_to_bridge(image_path, source = 'SketchUp')
    unless File.exist?(image_path)
      UI.messagebox('[Anarchy AI] Captured image file could not be found.')
      return false
    end

    raw_bytes = File.binread(image_path)
    base64_data = Base64.strict_encode64(raw_bytes)
    data_url = "data:image/jpeg;base64,#{base64_data}"

    token = auth_token
    uri = URI.parse(BRIDGE_URL)

    payload = {
      image: data_url,
      source: source
    }

    req = Net::HTTP::Post.new(uri.request_uri)
    req['Content-Type'] = 'application/json'
    req['x-anarchy-token'] = token unless token.empty?
    req.body = JSON.generate(payload)

    http = Net::HTTP.new(uri.host, uri.port)
    http.open_timeout = 3
    http.read_timeout = 6

    res = http.request(req)
    if res.code == '200'
      true
    else
      puts "[Anarchy AI] Server response #{res.code}: #{res.body}"
      false
    end
  rescue Errno::ECONNREFUSED
    UI.messagebox("Could not connect to Anarchy AI.\\n\\nPlease ensure Anarchy AI is open and running on your computer.")
    false
  rescue => e
    puts "[Anarchy AI] Sync error: #{e.message}"
    UI.messagebox("Anarchy AI Sync error: #{e.message}")
    false
  ensure
    begin
      File.delete(image_path) if File.exist?(image_path)
    rescue => _e
    end
  end

  def self.send_camera_metadata
    model = Sketchup.active_model
    return unless model

    view = model.active_view
    return unless view

    camera = view.camera
    current_page = model.pages.selected_page
    scene_name = current_page ? current_page.name : 'Active View'

    eye = camera.eye
    target = camera.target
    up = camera.up

    meta = {
      software: 'sketchup',
      version: Sketchup.version,
      sceneName: scene_name,
      camera: {
        fov: camera.fov,
        perspective: camera.perspective?,
        eye: [eye.x.to_f, eye.y.to_f, eye.z.to_f],
        target: [target.x.to_f, target.y.to_f, target.z.to_f],
        up: [up.x.to_f, up.y.to_f, up.z.to_f]
      }
    }

    token = auth_token
    uri = URI.parse(BIM_URL)
    req = Net::HTTP::Post.new(uri.request_uri)
    req['Content-Type'] = 'application/json'
    req['x-anarchy-token'] = token unless token.empty?
    req.body = JSON.generate(meta)

    http = Net::HTTP.new(uri.host, uri.port)
    http.open_timeout = 1
    http.read_timeout = 2
    http.request(req)
  rescue => _e
  end

  def self.send_viewport
    Sketchup.status_text = '[Anarchy AI] Capturing viewport...'
    img_path = capture_viewport_image(1920)
    unless img_path
      UI.messagebox('[Anarchy AI] Failed to capture SketchUp viewport.')
      return
    end

    send_camera_metadata
    success = post_image_to_bridge(img_path, 'SketchUp Viewport')
    if success
      Sketchup.status_text = '[Anarchy AI] Viewport sent successfully to Anarchy AI!'
    end
  end

  def self.instant_render
    Sketchup.status_text = '[Anarchy AI] Preparing Instant Render...'
    img_path = capture_viewport_image(2560)
    unless img_path
      UI.messagebox('[Anarchy AI] Failed to capture SketchUp viewport.')
      return
    end

    send_camera_metadata
    success = post_image_to_bridge(img_path, 'SketchUp Instant Render')
    if success
      Sketchup.status_text = '[Anarchy AI] Sent for Instant AI Render!'
    end
  end

  def self.batch_export_scenes
    model = Sketchup.active_model
    unless model
      UI.messagebox('[Anarchy AI] No active SketchUp model open.')
      return
    end

    pages = model.pages
    if pages.count.zero?
      UI.messagebox("No Scenes found in this model.\\nCreate scene tabs first in SketchUp (Window > Scenes) to use Batch Export.")
      return
    end

    answer = UI.messagebox("Batch export all #{pages.count} Scene(s) to Anarchy AI?", MB_YESNO)
    return unless answer == IDYES

    original_page = pages.selected_page
    exported = 0

    pages.each_with_index do |page, idx|
      pages.selected_page = page
      model.active_view.refresh
      sleep(0.15)

      Sketchup.status_text = "[Anarchy AI] Exporting Scene: #{page.name} (#{idx + 1}/#{pages.count})..."
      img_path = capture_viewport_image(2048)
      if img_path
        send_camera_metadata
        exported += 1 if post_image_to_bridge(img_path, "SketchUp: #{page.name}")
      end
    end

    pages.selected_page = original_page if original_page
    UI.messagebox("[Anarchy AI] Batch export finished!\\nSuccessfully sent #{exported} of #{pages.count} scenes to Anarchy AI.")
  end

  def self.show_settings
    token = auth_token
    token_status = token.empty? ? 'Not authenticated (Run Anarchy AI first)' : 'Connected & Token Authenticated'

    msg = <<~INFO
      ====================================
      Anarchy AI Bridge for SketchUp
      ====================================
      Plugin Version: #{VERSION}
      SketchUp: #{Sketchup.version}
      Local Bridge: #{BRIDGE_URL}
      Auth Status: #{token_status}

      Included Tools:
      1. Send Viewport (Active Camera)
      2. Instant AI Render (2560px UHD)
      3. Batch Scenes Export (All Scene Tabs)
      4. Camera & Metadata Sync
    INFO

    UI.messagebox(msg, MB_OK)
  end

  def self.init_ui
    return if @ui_initialized
    @ui_initialized = true

    icons_dir = File.join(File.dirname(__FILE__), 'icons')
    tb = UI::Toolbar.new('Anarchy AI')

    cmd_vp = UI::Command.new('Send Viewport') { send_viewport }
    cmd_vp.tooltip = 'Send Viewport to Anarchy AI'
    cmd_vp.status_bar_text = 'Send current active SketchUp view to Anarchy AI Canvas'
    cmd_vp.small_icon = File.join(icons_dir, 'viewport_16.png')
    cmd_vp.large_icon = File.join(icons_dir, 'viewport_24.png')
    tb.add_item(cmd_vp)

    cmd_rnd = UI::Command.new('Instant AI Render') { instant_render }
    cmd_rnd.tooltip = 'Instant AI Render'
    cmd_rnd.status_bar_text = 'Trigger instant high-resolution AI render'
    cmd_rnd.small_icon = File.join(icons_dir, 'render_16.png')
    cmd_rnd.large_icon = File.join(icons_dir, 'render_24.png')
    tb.add_item(cmd_rnd)

    cmd_batch = UI::Command.new('Batch Scenes Export') { batch_export_scenes }
    cmd_batch.tooltip = 'Batch Export All Scenes'
    cmd_batch.status_bar_text = 'Export all scene tabs to Anarchy AI Builder'
    cmd_batch.small_icon = File.join(icons_dir, 'batch_16.png')
    cmd_batch.large_icon = File.join(icons_dir, 'batch_24.png')
    tb.add_item(cmd_batch)

    cmd_set = UI::Command.new('Settings') { show_settings }
    cmd_set.tooltip = 'Anarchy AI Settings & Status'
    cmd_set.status_bar_text = 'Check bridge connection and plugin status'
    cmd_set.small_icon = File.join(icons_dir, 'settings_16.png')
    cmd_set.large_icon = File.join(icons_dir, 'settings_24.png')
    tb.add_item(cmd_set)

    if tb.get_last_state == TB_VISIBLE || tb.get_last_state == TB_NEVER_SHOWN
      tb.show
    end

    ext_menu = UI.menu('Extensions').add_submenu('Anarchy AI')
    ext_menu.add_item(cmd_vp)
    ext_menu.add_item(cmd_rnd)
    ext_menu.add_item(cmd_batch)
    ext_menu.add_separator
    ext_menu.add_item(cmd_set)
  end
end

AnarchyAI.init_ui unless defined?(@anarchy_loaded)
@anarchy_loaded = true
`;
