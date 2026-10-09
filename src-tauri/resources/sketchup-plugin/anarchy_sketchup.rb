# frozen_string_literal: true
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
