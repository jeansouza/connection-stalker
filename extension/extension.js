'use strict'

// Imports
const CLUTTER = imports.gi.Clutter
const G_LIB = imports.gi.GLib
const G_OBJECT = imports.gi.GObject
const GIO = imports.gi.Gio
const EXTENSION_UTILS = imports.misc.extensionUtils
const MAIN = imports.ui.main
const MAIN_LOOP = imports.mainloop
const PANEL_MENU = imports.ui.panelMenu
const POPUP_MENU = imports.ui.popupMenu
const SHELL = imports.gi.Shell
const SOUP = imports.gi.Soup
const ST = imports.gi.St

// Constants
const CANT_GET_LOCAL_IP = `Can't get local ip`
const ME = EXTENSION_UTILS.getCurrentExtension()
const CONVENIENCE = ME.imports.convenience
const CONNECTION_REFUSED = 'Connection refused'
const CLIPBOARD = ST.Clipboard.get_default()
const CLIPBOARD_TYPE = ST.ClipboardType.CLIPBOARD
const ERROR_ICON = GIO.icon_new_for_string(`${ME.path}/icons/flags/error.png`)
const MENU_POSITION = 'right'
const METADATA = ME.metadata
const NO_CONNECTION = 'Waiting for connection'
const SETTINGS = CONVENIENCE.getSettings()
const STATUS_AREA_ID = 'connection-stalker-status-area'

// Globals
const _defaultData = {
  ip: 'no connection',
  hostname: '',
  city: '',
  region: '',
  country: '',
  loc: '',
  org: '',
  postal: '',
  timezone: ''
}
let _label = null
let _icon = null
let _ipInfoRows = {}
let _ipInfoBox = null

const makeHttpSession = () => {
  const httpSession = new SOUP.SessionAsync()
  SOUP.Session.prototype.add_feature.call(httpSession, new SOUP.ProxyResolverDefault())
  return httpSession
}

const servicesRequestProcessors = {
  'ipinfo.io': {
    endpoint: 'https://ipinfo.io/',
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = SOUP.Message.new('GET', this.endpoint)
      const processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.country }

        clearIpInfoRows()

        Object.keys(responseData).map(function (key) {
          try {
            setIpInfoRow(key, responseData[key])
          } catch (e) { }
        })

        callback(simplifiedResponseData)
      }

      httpSession.queue_message(request, processRequest)
    }
  },

  'ip-api.com': {
    endpoint: `http://ip-api.com/json/?fields=status,countryCode,query`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = SOUP.Message.new('GET', this.endpoint)
      const processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.query, countryCode: responseData.countryCode }
        clearIpInfoRows()

        Object.keys(responseData).map(function (key) {
          try {
            setIpInfoRow(key, responseData[key])
          } catch (e) { }
        })
        callback(simplifiedResponseData)
      }

      httpSession.queue_message(request, processRequest)
    }
  },

  'myip.com': {
    endpoint: `https://api.myip.com`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = SOUP.Message.new('GET', this.endpoint)
      const processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.cc }
        clearIpInfoRows()

        Object.keys(responseData).map(function (key) {
          try {
            setIpInfoRow(key, responseData[key])
          } catch (e) { }
        })
        callback(simplifiedResponseData)
      }

      httpSession.queue_message(request, processRequest)
    }
  },

  'ip.sb': {
    endpoint: `https://api.ip.sb/geoip`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = SOUP.Message.new('GET', this.endpoint)
      const processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.country_code }
        clearIpInfoRows()

        Object.keys(responseData).map(function (key) {
          try {
            setIpInfoRow(key, responseData[key])
          } catch (e) { }
        })
        callback(simplifiedResponseData)
      }

      httpSession.queue_message(request, processRequest)
    }
  },
  // thanks to https://github.com/Josholith/gnome-extension-lan-ip-address/blob/master/extension.js
  'local-ip': {
    process: function (callback) {
      let lanIpAddress = CANT_GET_LOCAL_IP

      try {
        const commandOutputBytes = G_LIB.spawn_command_line_sync('ip route get 1.1.1.1')[1]
        let commandOutputString = Array.from(commandOutputBytes).reduce(
          (accumulator, currentValue) => accumulator + String.fromCharCode(currentValue),
          ''
        )
        let matches = commandOutputString.match(/src [^ ]+/g)
        lanIpAddress = matches ? matches[0].split(' ')[1] : CANT_GET_LOCAL_IP

        clearIpInfoRows()

        Object.keys(responseData).map(function (key) {
          try {
            setIpInfoRow(key, responseData[key])
          } catch (e) { }
        })
      } catch (e) { }

      callback({ ip: lanIpAddress, countryCode: 'LOCAL' })
    }
  }
}

const displayModeProcessors = {
  'IP, flag and country': (responseData) => {
    if (!responseData) {
      _label.text = CONNECTION_REFUSED
      _icon.gicon = ERROR_ICON
      _icon.style_class = 'system-status-icon'
    } else {
      _label.text = `${responseData.countryCode} | ${responseData.ip}`
      _icon.gicon = GIO.icon_new_for_string(`${ME.path}/icons/flags/${responseData.countryCode}.png`)
      _icon.style_class = 'icon-style-custom'
    }
  },
  'IP and flag': (responseData) => {
    if (!responseData) {
      _label.text = CONNECTION_REFUSED
      _icon.gicon = ERROR_ICON
      _icon.style_class = 'system-status-icon'
    } else {
      _label.text = responseData.ip
      _icon.gicon = GIO.icon_new_for_string(`${ME.path}/icons/flags/${responseData.countryCode}.png`)
      _icon.style_class = 'icon-style-custom'
    }
  },
  'Only flag': (responseData) => {
    _label.text = ''

    if (!responseData) {
      _icon.gicon = ERROR_ICON
      _icon.style_class = 'system-status-icon'
    } else {
      _icon.gicon = GIO.icon_new_for_string(`${ME.path}/icons/flags/${responseData.countryCode}.png`)
      _icon.style_class = 'custom-icon-style-only-flag'
    }
  },
  'Only IP': (responseData) => {
    _icon.gicon = null
    _icon.style_class = ''
    _label.text = !responseData ? CONNECTION_REFUSED : responseData.ip
  }
}

const _makeRequest = () => {
  const currentService = SETTINGS.get_string('api-service')
  const currentMode = SETTINGS.get_string('display-mode')
  const service = servicesRequestProcessors[currentService]
  const requestCallback = displayModeProcessors[currentMode]
  service.process(requestCallback)
}

class ConnectionStalkerClass extends PANEL_MENU.Button {
  _init(menuAlignment, nameText, dontCreateMenu) {
    super._init(0.0, 'Ip Info Indicator', false)
    let hbox = new ST.BoxLayout({ style_class: 'ip-data-panel' })

    _icon = new ST.Icon({
      gicon: null,
      style_class: 'icon-style-custom'
    })

    _label = new ST.Label({
      text: SETTINGS.get_boolean('display-mode') ? '' : NO_CONNECTION,
      y_align: CLUTTER.ActorAlign.CENTER
    })

    hbox.add_child(_icon)
    hbox.add_child(_label)

    this.actor.add_actor(hbox)

    //main containers
    let ipInfo = new POPUP_MENU.PopupBaseMenuItem({ reactive: false })
    let parentContainer = new ST.BoxLayout() //main container that holds ip info and map

    //ipinfo
    _ipInfoBox = new ST.BoxLayout({ style_class: 'ip-info-box', vertical: true })
    parentContainer.add_actor(_ipInfoBox)
    ipInfo.actor.add(parentContainer)
    this.menu.addMenuItem(ipInfo)

    Object.keys(_defaultData).map((key) => {
      setIpInfoRow(key, _defaultData[key])
    })

    const appSys = SHELL.AppSystem.get_default()
    const gsmPrefs = appSys.lookup_app('gnome-shell-extension-prefs.desktop')

    const prefs = new POPUP_MENU.PopupMenuItem('Preferences...')

    prefs.connect('activate', () => {
      if (gsmPrefs.get_state() === gsmPrefs.SHELL_APP_STATE_RUNNING) {
        gsmPrefs.activate()
      } else {
        const info = gsmPrefs.get_app_info()
        const timestamp = global.display.get_current_time_roundtrip()
        info.launch_uris([METADATA.uuid], global.create_app_launch_context(timestamp, -1))
      }
    })

    this.menu.addMenuItem(prefs)

    MAIN.panel.addToStatusArea(STATUS_AREA_ID, this, 1, MENU_POSITION)

    this.destroy = () => {
      this.removeTimer()
      super.destroy()
    }

    this.update = () => {
      _makeRequest()
      return true
    }

    this.removeTimer = () => {
      if (this.timer) {
        MAIN_LOOP.source_remove(this.timer)
        this.timer = null
      }
    }

    this.updateRefreshRate = () => {
      this.refreshRate = SETTINGS.get_int('refresh-rate')
      this.removeTimer()
      this.timer = MAIN_LOOP.timeout_add_seconds(this.refreshRate, this.update.bind(this))
    }

    this.updateDisplayMode = () => {
      MAIN.panel.statusArea[STATUS_AREA_ID] = null
      MAIN.panel.addToStatusArea(STATUS_AREA_ID, this, 1, MENU_POSITION)
      this.update()
    }

    this.onClick = () => {
      this.update()
    }

    this.updateService = () => {
      this.update()
    }

    SETTINGS.connect('changed::refresh-rate', this.updateRefreshRate.bind(this))
    SETTINGS.connect('changed::display-mode', this.updateDisplayMode.bind(this))
    SETTINGS.connect('changed::api-service', this.updateService.bind(this))

    this.actor.connect('button-press-event', this.onClick.bind(this))

    this.update()
    this.updateRefreshRate()
  }
}

const ConnectionStalker = G_OBJECT.registerClass(ConnectionStalkerClass)

const removeItemFromIpInfoRows = (key) => {
  if (_ipInfoRows.hasOwnProperty(key)) {
    _ipInfoBox.remove_child(_ipInfoRows[key])

    delete _ipInfoRows[key]
  }
}

const clearIpInfoRows = () => {
  for (const key in _ipInfoRows) {
    removeItemFromIpInfoRows(key)
  }
}

const setIpInfoRow = (key, value) => {
  removeItemFromIpInfoRows(key)

  const ipInfoRow = new ST.BoxLayout()

  ipInfoRow.add_actor(new ST.Label({
    style_class: 'ip-info-key',
    text: key + ': '
  }))

  const dataLabelBtn = new ST.Button({
    child: new ST.Label({
      style_class: 'ip-info-value',
      text: value
    })
  })

  dataLabelBtn.connect('button-press-event', function () {
    CLIPBOARD.set_text(CLIPBOARD_TYPE, dataLabelBtn.child.text)
  })

  ipInfoRow.add_actor(dataLabelBtn)

  _ipInfoRows[key] = ipInfoRow

  _ipInfoBox.add_actor(ipInfoRow)
}

let _indicator

const init = () => {}

const enable = () => _indicator = new ConnectionStalker

const disable = () => _indicator.destroy()
