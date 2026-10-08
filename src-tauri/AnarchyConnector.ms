-- Anarchy AI 3ds Max Bridge
global AnarchyRollout
global sendViewportToAnarchy
global createAnarchyMenu
global createAnarchyToolbar

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
		py_cmd += "    url = 'http://127.0.0.1:14400/upload-view'\n"
		py_cmd += "    payload = json.dumps({'type': 'EXTERNAL_IMAGE_NODE', 'image': 'data:image/jpeg;base64,' + data, 'source': '3dsmax'}).encode('utf-8')\n"
		py_cmd += "    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json', 'X-Anarchy-Token': token})\n"
		py_cmd += "    urllib.request.urlopen(req, timeout=3)\n"
		py_cmd += "    print('Anarchy AI: Viewport sent successfully to Anarchy AI Builder!')\n"
		py_cmd += "except Exception as e: print('Anarchy AI: Sync notice - ' + str(e))"
		python.execute py_cmd
	) catch (
		print "Anarchy AI: Viewport capture complete."
	)
)

try ( colorman.reInitIcons() ) catch ()

macroScript AnarchySync
category:"Anarchy"
buttonText:"Anarchy AI"
toolTip:"Send active viewport to Anarchy AI"
icon:#("AnarchyLogo", 1)
(
	on execute do (
		global sendViewportToAnarchy
		sendViewportToAnarchy()
	)
)

-- Auto-create Menu Item on startup
fn createAnarchyMenu = (
	try (
		if menuMan != undefined and (menuMan.getMainMenuBar()) != undefined do (
			local mainMenuBar = menuMan.getMainMenuBar()
			local menuName = "Anarchy AI"
			local existingMenu = menuMan.findMenu menuName
			if existingMenu == undefined do (
				local newMenu = menuMan.createMenu menuName
				local actionItem = menuMan.createActionItem "AnarchySync" "Anarchy"
				newMenu.addItem actionItem 1
				local subMenuItem = menuMan.createSubMenuItem menuName newMenu
				mainMenuBar.addItem subMenuItem (mainMenuBar.numItems() + 1)
				menuMan.updateMenuBar()
			)
		)
	) catch ()
)

-- Auto-create Toolbar Dockable Bar
fn createAnarchyToolbar = (
	try (
		rollout AnarchyRollout "Anarchy AI" width:110 height:38 (
			button btnSend "⚡ Send to Anarchy" pos:[5,5] width:100 height:28 toolTip:"Send active viewport directly to Anarchy AI Builder"
			on btnSend pressed do (
				global sendViewportToAnarchy
				sendViewportToAnarchy()
			)
		)
		createDialog AnarchyRollout style:#(#style_toolwindow, #style_sysmenu)
		cui.RegisterDialogBar AnarchyRollout style:#(#cui_dock_all, #cui_floatable)
		cui.DockDialogBar AnarchyRollout #cui_dock_top
	) catch ()
)

createAnarchyMenu()
try ( createAnarchyToolbar() ) catch ()

-- Autonomous CUA Agent Poller for 3ds Max
global anarchyCuaTimer
global pollAnarchyCuaCommands

fn pollAnarchyCuaCommands = (
	try (
		local startupDir = (getDir #startupScripts)
		local py_poll = "import os, sys, urllib.request, json\n"
		py_poll += ("startup_dir = r'" + startupDir + "'\n")
		py_poll += "try:\n"
		py_poll += "    token_path = os.path.expandvars(r'%APPDATA%\\\\com.anarchyai.app\\\\.token')\n"
		py_poll += "    token = ''\n"
		py_poll += "    if os.path.exists(token_path):\n"
		py_poll += "        with open(token_path, 'r') as tf: token = tf.read().strip()\n"
		py_poll += "    url = 'http://127.0.0.1:14400/agent/poll-command?software=3dsmax'\n"
		py_poll += "    processed = 0\n"
		py_poll += "    while processed < 12:\n"
		py_poll += "        req = urllib.request.Request(url, headers={'X-Anarchy-Token': token, 'X-Autodesk-Software': '3dsmax'})\n"
		py_poll += "        res = urllib.request.urlopen(req, timeout=1)\n"
		py_poll += "        data = json.loads(res.read().decode('utf-8'))\n"
		py_poll += "        cmd = data.get('command')\n"
		py_poll += "        if not cmd:\n"
		py_poll += "            break\n"
		py_poll += "        processed += 1\n"
		py_poll += "        action = cmd.get('action', '')\n"
		py_poll += "        cmd_id = cmd.get('id', '')\n"
		py_poll += "        script = cmd.get('script', '')\n"
		py_poll += "        params = cmd.get('params') or {}\n"
		py_poll += "        import pymxs\n"
		py_poll += "        res_output = ''\n"
		py_poll += "        res_err = None\n"
		py_poll += "        try:\n"
		py_poll += "            if action == 'viewport_sync' or action == 'capture':\n"
		py_poll += "                pymxs.runtime.sendViewportToAnarchy()\n"
		py_poll += "                res_output = json.dumps({'success': True, 'message': 'Viewport synchronized to Anarchy AI'})\n"
		py_poll += "            elif action == 'tool_call':\n"
		py_poll += "                for p in [startup_dir, os.path.expandvars(r'%APPDATA%\\\\com.anarchyai.app'), r'C:\\\\Program Files\\\\Anarchy AI\\\\resources']:\n"
		py_poll += "                    if p and os.path.exists(p) and p not in sys.path: sys.path.insert(0, p)\n"
		py_poll += "                tool_name = params.get('tool_name') or params.get('toolName') or script\n"
		py_poll += "                tool_args = params.get('parameters') if 'parameters' in params else {k: v for k, v in params.items() if k not in ['tool_name', 'toolName']}\n"
		py_poll += "                tool_success = False\n"
		py_poll += "                try:\n"
		py_poll += "                    import PymxsTools\n"
		py_poll += "                    import importlib\n"
		py_poll += "                    importlib.reload(PymxsTools)\n"
		py_poll += "                    tool_res = PymxsTools.execute_tool(tool_name, tool_args)\n"
		py_poll += "                    if tool_res.get('success'):\n"
		py_poll += "                        res_output = json.dumps(tool_res)\n"
		py_poll += "                        tool_success = True\n"
		py_poll += "                    else:\n"
		py_poll += "                        res_err = tool_res.get('error', 'Tool execution failed')\n"
		py_poll += "                except Exception as py_err:\n"
		py_poll += "                    res_err = 'PymxsTools error: ' + str(py_err)\n"
		py_poll += "                if not tool_success:\n"
		py_poll += "                    # NO silent fallback: a failed tool must be reported as failed, never replaced by a canned model.\n"
		py_poll += "                    res_err = str(res_err or 'Tool failed') + ' [tool did not run - nothing was created in the scene]'\n"
		py_poll += "            elif script:\n"
		py_poll += "                # pymxs.undo as a context manager: a stray ')' in the script can no longer break out of an undo wrapper\n"
		py_poll += "                with pymxs.undo(True, 'Anarchy AI'):\n"
		py_poll += "                    pymxs.runtime.execute(script)\n"
		py_poll += "                res_output = json.dumps({'success': True, 'message': 'MaxScript executed successfully with Undo support'})\n"
		py_poll += "        except Exception as ex:\n"
		py_poll += "            res_err = str(ex)\n"
		py_poll += "        res_url = 'http://127.0.0.1:14400/agent/command-result'\n"
		py_poll += "        res_payload = json.dumps({'id': cmd_id, 'success': res_err is None, 'output': res_output, 'error': res_err}).encode('utf-8')\n"
		py_poll += "        res_req = urllib.request.Request(res_url, data=res_payload, headers={'Content-Type': 'application/json', 'X-Anarchy-Token': token})\n"
		py_poll += "        urllib.request.urlopen(res_req, timeout=2)\n"
		py_poll += "except Exception:\n"
		py_poll += "    pass\n"
		python.execute py_poll
	) catch ()
)

-- Safe CUA Agent Poller management
global anarchyCuaTimer
global stopAnarchyCuaTimer
global startAnarchyCuaTimer

fn stopAnarchyCuaTimer = (
	try (
		if anarchyCuaTimer != undefined do (
			anarchyCuaTimer.Stop()
			dotnet.removeAllEventHandlers anarchyCuaTimer
			anarchyCuaTimer.Dispose()
			anarchyCuaTimer = undefined
		)
	) catch ()
)

fn startAnarchyCuaTimer = (
	stopAnarchyCuaTimer()
	try (
		anarchyCuaTimer = dotNetObject "System.Windows.Forms.Timer"
		anarchyCuaTimer.Interval = 2500
		dotnet.addEventHandler anarchyCuaTimer "Tick" (fn onTimerTick s e = (
			try (
				if not (theHold.Holding()) and not (isCreatingObject()) and not (animating) do (
					pollAnarchyCuaCommands()
				)
			) catch ()
		))
		anarchyCuaTimer.Start()
	) catch ()
)

-- Stop timer on startup so 3ds Max remains stable and free of SEHException / unhandled .NET crashes
stopAnarchyCuaTimer()

try ( callbacks.removeScripts id:#AnarchyMenuSetup ) catch ()
try ( callbacks.addScript #postSystemStartup "createAnarchyMenu(); createAnarchyToolbar()" id:#AnarchyMenuSetup ) catch ()

