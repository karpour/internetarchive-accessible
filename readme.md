# Accessible Archive

This project creates an interface for [the Internet Archive](https://archive.org) that can be used with older user agents.

The server uses internetarchive-ts for any API access to archive.org and serves the pages using one of a few renderers.

## Rendering modes

Depending on the user agent used to access this service, different rendering modes are used based on the user agent string.

Currently supported modes are:

- `text` - for text-mode browsers such as Lynx, Links and w3m
- `html4` - For older html4 browsers, i.e. IE4
- `ppc` - for Windows CE PocketPC devices
- `wap2` for WAP browsers supporting XHTML-MP