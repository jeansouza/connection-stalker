const St = imports.gi.St
const Main = imports.ui.main
const Soup = imports.gi.Soup
const Mainloop = imports.mainloop
const Clutter = imports.gi.Clutter
const PanelMenu = imports.ui.panelMenu
const Gio = imports.gi.Gio
const Shell = imports.gi.Shell
const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()
const Metadata = Me.metadata
const Convenience = Me.imports.convenience
const Settings = Convenience.getSettings()
const GLib = imports.gi.GLib
const PopupMenu = imports.ui.popupMenu
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD
const Clipboard = St.Clipboard.get_default()
const NO_CONNECTION = 'Waiting for connection'
const CANT_GET_LOCAL_IP = `Can't get local ip`
const MENU_POSITION = 'right'
const CONNECTION_REFUSED = 'Connection refused'
const STATUS_AREA_ID = 'connection-stalker-status-area'

const DEFAULT_DATA = {
  ip: "No Connection",
  hostname: '',
  city: '',
  region: '',
  country: '',
  loc: '',
  org: '',
  postal: '',
  timezone: ''
}

let _label, _icon
let _buttons = {}

const makeHttpSession = () => {
  let httpSession = new Soup.SessionAsync()
  Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault())
  return httpSession
}

const servicesRequestProcessors = {
  'ipinfo.io': {
    endpoint: 'https://ipinfo.io/',
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = Soup.Message.new('GET', this.endpoint)
      const _processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(message.status_code, null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.country }

        Object.keys(responseData).map(function(key) {
          try {
          _buttons['_' + key].child.text = responseData[key]
          }catch(e){}
        })


        callback(null, simplifiedResponseData)
      }

      httpSession.queue_message(request, _processRequest)
    }
  },

  'ip-api.com': {
    endpoint: `http://ip-api.com/json/?fields=status,countryCode,query`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = Soup.Message.new('GET', this.endpoint)
      const _processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(message.status_code, null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.query, countryCode: responseData.countryCode }
        _buttons['_' + 'country'].child.text = JSON.stringify(responseData)
        callback(null, simplifiedResponseData)
      }

      httpSession.queue_message(request, _processRequest)
    }
  },

  'ipapi.co': {
    endpoint: `https://ipapi.co/json/`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = Soup.Message.new('GET', this.endpoint)
      const _processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(message.status_code, null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        if (responseData.error) {
          callback(responseData.reason, null)
          return
        }
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.country }
        _buttons['_' + 'country'].child.text = JSON.stringify(responseData)
        callback(null, simplifiedResponseData)
      }

      httpSession.queue_message(request, _processRequest)
    }
  },

  'myip.com': {
    endpoint: `https://api.myip.com`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = Soup.Message.new('GET', this.endpoint)
      const _processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(message.status_code, null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.cc }
        _buttons['_' + 'country'].child.text = JSON.stringify(responseData)
        callback(null, simplifiedResponseData)
      }

      httpSession.queue_message(request, _processRequest)
    }
  },

  'ip.sb': {
    endpoint: `https://api.ip.sb/geoip`,
    process: function (callback) {
      let httpSession = makeHttpSession()
      let request = Soup.Message.new('GET', this.endpoint)
      const _processRequest = (httpSession, message) => {
        if (message.status_code !== 200) {
          callback(message.status_code, null)
          return
        }
        let responseJSON = request.response_body.data
        let responseData = JSON.parse(responseJSON)
        let simplifiedResponseData = { ip: responseData.ip, countryCode: responseData.country_code }
        _buttons['_' + 'country'].child.text = JSON.stringify(responseData)
        callback(null, simplifiedResponseData)
      }

      httpSession.queue_message(request, _processRequest)
    }
  },
  // thanks to https://github.com/Josholith/gnome-extension-lan-ip-address/blob/master/extension.js
  'local-ip': {
    process: function (callback) {
      const commandOutputBytes = GLib.spawn_command_line_sync('ip route get 1.1.1.1')[1]
      let commandOutputString = Array.from(commandOutputBytes).reduce(
        (accumulator, currentValue) => accumulator + String.fromCharCode(currentValue),
        ''
      )
      let matches = commandOutputString.match(/src [^ ]+/g)
      const lanIpAddress = matches ? matches[0].split(' ')[1] : CANT_GET_LOCAL_IP
      _buttons['_' + 'country'].child.text = JSON.stringify(lanIpAddress)
      callback(null, { ip: lanIpAddress })
    }
  }
}

const displayModeProcessors = {
  'ip-and-flag': (err, responseData) => {
    _label.text = !responseData ? CONNECTION_REFUSED : responseData.ip

    _icon.gicon = !responseData ?
      Gio.icon_new_for_string(`${Me.path}/icons/flags/error.png`) :
      selectIcon(responseData)
  },
  'only-flag': (err, responseData) => {
    _label.text = ''

    _icon.gicon = !responseData ?
      Gio.icon_new_for_string(`${Me.path}/icons/flags/error.png`) :
      selectIcon(responseData)
  },
  'only-ip': (err, responseData) => {
    _label.text = !responseData ? CONNECTION_REFUSED : responseData.ip

    _icon.gicon = null
  }
}

const selectIcon = (responseData) => {
  const currentService = Settings.get_string('api-service')
  return currentService === 'local-ip' ?
    Gio.icon_new_for_string(`${Me.path}/icons/flags/local-ip-icon.png`) :
    Gio.icon_new_for_string(`${Me.path}/icons/flags/${responseData.countryCode}.png`)
}

const _makeRequest = () => {
  const currentService = Settings.get_string('api-service'),
    currentMode = Settings.get_string('display-mode')
  const service = servicesRequestProcessors[currentService]
  const requestCallback = displayModeProcessors[currentMode]
  service.process(requestCallback)
}

class IpInfoIndicator extends PanelMenu.Button {
  constructor() {
    super(0.0, "Ip Info Indicator", false)
    let hbox = new St.BoxLayout({ style_class: 'ip-data-panel' })

    _icon = new St.Icon({
      gicon: null,
      style_class: 'custom-icon-style'
    })

    _label = new St.Label({
      text: Settings.get_boolean('display-mode') ? '' : NO_CONNECTION,
      y_align: Clutter.ActorAlign.CENTER
    })

    hbox.add_child(_icon)
    hbox.add_child(_label)

    this.actor.add_actor(hbox)

    //main containers
    let ipInfo = new PopupMenu.PopupBaseMenuItem({reactive: false})
    let parentContainer = new St.BoxLayout() //main container that holds ip info and map
    //

    //ipinfo
    let ipInfoBox = new St.BoxLayout({style_class: 'ip-info-box', vertical: true})
    parentContainer.add_actor(ipInfoBox)
    ipInfo.actor.add(parentContainer)
    this.menu.addMenuItem(ipInfo)

    Object.keys(DEFAULT_DATA).map((key) => {
      let ipInfoRow = new St.BoxLayout()
      ipInfoBox.add_actor(ipInfoRow)
      ipInfoRow.add_actor(new St.Label({style_class: 'ip-info-key', text: key + ': '}))

      let dataLabelBtn = new St.Button({child: new St.Label({style_class: 'ip-info-value', text: DEFAULT_DATA[key]})})
      dataLabelBtn.connect('button-press-event', function() {
        
        Clipboard.set_text(CLIPBOARD_TYPE, dataLabelBtn.child.text)
      })
      ipInfoRow.add_actor(dataLabelBtn)
      _buttons['_' + key] = dataLabelBtn
    })

    let _appSys = Shell.AppSystem.get_default()
    let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop')

    let prefs

    prefs = new PopupMenu.PopupMenuItem("Preferences...")

    prefs.connect('activate', function() {
      if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING) {
        _gsmPrefs.activate()
      } else {
        let info = _gsmPrefs.get_app_info()
        let timestamp = global.display.get_current_time_roundtrip()
        info.launch_uris([Metadata.uuid], global.create_app_launch_context(timestamp, -1))
      }
    })

    this.menu.addMenuItem(prefs)

    Main.panel.addToStatusArea(STATUS_AREA_ID, this, 1, MENU_POSITION)

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
        Mainloop.source_remove(this.timer)
        this.timer = null
      }
    }

    this.updateRefreshRate = () => {
      this.refreshRate = Settings.get_int('refresh-rate')
      this.removeTimer()
      this.timer = Mainloop.timeout_add_seconds(this.refreshRate, this.update.bind(this))
    }

    this.updateDisplayMode = () => {
      Main.panel.statusArea[STATUS_AREA_ID] = null
      Main.panel.addToStatusArea(STATUS_AREA_ID, this, 1, MENU_POSITION)
      this.update()
    }

    this.onClick = () => {
      this.update()
    }

    this.updateService = () => {
      this.update()
    }

    Settings.connect('changed::refresh-rate', this.updateRefreshRate.bind(this))
    Settings.connect('changed::display-mode', this.updateDisplayMode.bind(this))
    Settings.connect('changed::api-service', this.updateService.bind(this))

    this.actor.connect('button-press-event', this.onClick.bind(this))

    this.update()
    this.updateRefreshRate()
  }
}

let _indicator

const init = () => { /* Empty */ }

const enable = () => _indicator = new IpInfoIndicator

const disable = () => _indicator.destroy()
