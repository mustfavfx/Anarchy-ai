-- Anarchy UI Simple Bridge
global AnarchyRollout

try(cui.UnRegisterDialogBar AnarchyRollout)catch()
try(destroyDialog AnarchyRollout)catch()
try(unregisterRedrawViewsCallback triggerAnarchySync)catch()
try(unregisterTimeCallback triggerAnarchySync)catch()

fn sendViewportToAnarchy = (
	try (
		local temp_path = (getDir #temp) + "\\anarchy_sync.jpg"
		local old_sel = getCurrentSelection()
		local old_viewcube = undefined
		try ( old_viewcube = ViewCubeOps.Visibility ) catch ()
		try ( ViewCubeOps.Visibility = false ) catch ()
		try ( viewport.setShowViewCube false ) catch ()
		try ( actionMan.executeAction 0 "40829" ) catch ()
		clearSelection()
		completeRedraw()
		local view_img = gw.getViewportDib()
		if old_sel.count > 0 do select old_sel
		try ( if old_viewcube != undefined do ViewCubeOps.Visibility = old_viewcube ) catch ()
		try ( if old_viewcube != undefined do viewport.setShowViewCube old_viewcube ) catch ()
		completeRedraw()
		local final_img = view_img
		if displaySafeFrames then (
			local r_aspect = renderWidth as float / renderHeight as float
			local v_w = view_img.width as float
			local v_h = view_img.height as float
			local v_aspect = v_w / v_h
			local crop_x = 0
			local crop_y = 0
			local crop_w = v_w as integer
			local crop_h = v_h as integer
			if v_aspect > r_aspect then (
				crop_h = v_h as integer
				crop_w = (v_h * r_aspect) as integer
				crop_x = ((v_w - crop_w) / 2.0) as integer
			) else (
				crop_w = v_w as integer
				crop_h = (v_w / r_aspect) as integer
				crop_y = ((v_h - crop_h) / 2.0) as integer
			)
			if crop_w > 0 and crop_h > 0 then (
				final_img = bitmap crop_w crop_h
				pasteBitmap view_img final_img (box2 crop_x crop_y crop_w crop_h) [0,0]
			)
		)
		local ui_crop_top = 22
		local ui_crop_right = 60
		local fc_w = (final_img.width - ui_crop_right) as integer
		local fc_h = (final_img.height - ui_crop_top) as integer
		if fc_w > 0 and fc_h > 0 then (
			local cropped = bitmap fc_w fc_h
			pasteBitmap final_img cropped (box2 0 ui_crop_top fc_w fc_h) [0,0]
			if final_img != view_img do close final_img
			final_img = cropped
		)
		final_img.filename = temp_path
		save final_img
		close final_img
		if final_img != view_img do close view_img
		local py_cmd = "import os, urllib.request, base64, json\n"
		py_cmd += "try:\n"
		py_cmd += "    token_path = os.path.expandvars(r'%APPDATA%\\\\com.anarchyai.app\\\\.token')\n"
		py_cmd += "    token = ''\n"
		py_cmd += "    if os.path.exists(token_path):\n"
		py_cmd += "        with open(token_path, 'r') as tf: token = tf.read().strip()\n"
		py_cmd += "    with open(r'" + temp_path + "', 'rb') as f: data = base64.b64encode(f.read()).decode()\n"
		py_cmd += "    url = 'http://localhost:14400/upload-view'\n"
		py_cmd += "    payload = json.dumps({'type': 'EXTERNAL_IMAGE_NODE', 'image': 'data:image/jpeg;base64,' + data, 'source': '3dsmax'}).encode('utf-8')\n"
		py_cmd += "    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json', 'X-Anarchy-Token': token})\n"
		py_cmd += "    urllib.request.urlopen(req, timeout=2)\n"
		py_cmd += "    print('Anarchy: Viewport Image Sent Successfully!')\n"
		py_cmd += "except Exception as e: print('Anarchy: Failed to send viewport image - ' + str(e))"
		python.execute py_cmd
	) catch (
		print "Anarchy: Viewport capture failed."
	)
)

try ( colorman.reInitIcons() ) catch ()

macroScript AnarchySync
category:"Anarchy"
buttonText:"Anarchy"
toolTip:"Send to Anarchy"
icon:#("AnarchyLogo", 1)
(
	on execute do (
		global sendViewportToAnarchy
		sendViewportToAnarchy()
	)
)
