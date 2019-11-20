<p align="center">
  <img src="https://raw.githubusercontent.com/jeansouza/connection-stalker/master/the-vicious-eye.png" alt="Wow" width="64"/>
</p>

# Connection Stalker

[![License Badge](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/rostegg/email-spoofing-server/blob/master/LICENSE)
[![Download](https://img.shields.io/static/v1.svg?label=Shell:&message=3.26-3.32&color=orange)](https://extensions.gnome.org/extension/1677/connection-stalker/)

[<img src="https://github.com/JasonLG1979/gnome-shell-extensions-mediaplayer/blob/master/data/get-it-on-ego.svg?sanitize=true" height="100">](https://extensions.gnome.org/extension/1677/connection-stalker/)

# How it look?

* Normal mode 

![Example](../assets/example.png)

* Only flag mode

![Example-Flag-Mode](../assets/example-only-flag.png)

* Available settings

![Example-Settings](../assets/settings.png)

# How to install on Arch Linux

If you are using Arch Linux feel free to use this AUR.

https://aur.archlinux.org/packages/gnome-shell-extension-connection-stalker-git/

```
git clone https://aur.archlinux.org/gnome-shell-extension-connection-stalker-git.git
cd gnome-shell-extension-connection-stalker-git
makepkg -sri
```

# How to install?

You can download extension from link above.

If you want install it manually, clone project to ~/.local/share/gnome-shell/extensions/connection-stalker-extension@rostegg.github.com folder and restart gnome desktop (Alt + F2 -> r -> Enter)

# Why 'Connection refused'?  
This may be for two reasons:
* Lack of internet connection  
* Lack of connection with the selected service (service is down, your ip was banned, etc). Now there are four services to choose from:  
  - http://ip-api.com/json/?fields=status,countryCode,query  
  - https://ipapi.co/json/  
  - https://api.myip.com  
  - https://api.ip.sb/geoip   

If you want to add own service, just create issue with link to api.

# Bug report  
For bug report provide gnome shell version (gnome-shell --version) and error message, if installation failed (Alt+F2 -> lg -> Extensions -> Show Errors).
