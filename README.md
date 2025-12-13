# NewTab++

A Chrome extension that enhances your new tab page with customizable shortcuts, themes, and productivity features.

## Features

-   🎯 Customizable shortcut grid
-   🌗 Light/dark theme support
-   ⚡ Fast and lightweight
-   🔄 Chrome sync integration
-   🎨 Modern, clean interface

## Installation

### From Chrome Web Store

_(Coming soon)_

### Local Development

1. Clone this repository:

    ```bash
    git clone https://github.com/yourusername/newtab-plus-plus.git
    ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

## Development

### Prerequisites

-   Chrome browser
-   Node.js 18+ (LTS) or 20+ (current LTS) for development tools

### Project Structure

```
NewTab++/
├── src/              # Source code
│   ├── newtab.html   # New tab page markup
│   ├── newtab.css    # New tab page styles
│   ├── newtab.js     # New tab page script
│   ├── popup.html    # Popup markup
│   ├── popup.css     # Popup styles
│   └── popup.js      # Popup script
├── public/           # Static assets
│   └── icons/        # Extension icons (128x128, 48x48, etc.)
├── manifest.json     # Chrome extension manifest
├── background.js     # Background/service worker script
├── README.md         # This file
├── PRIVACY.md        # Privacy policy
└── .gitignore        # Git ignore rules
```

### Getting Started

1. Make your changes
2. Reload the extension in Chrome
3. Test in a new tab

## Contributing

Contributions are welcome! Please read our contribution guidelines before submitting pull requests.

## Credits

-   Favicon service for shortcut icons
-   Extension icons should be placed in `public/icons/` with the following sizes: 128x128, 48x48, and 16x16
-   Inspired by various new tab extensions

## Support

If you encounter any issues or have feature requests, please file an issue on GitHub.
