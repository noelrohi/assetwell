# Changelog

All notable changes to Assetwell will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses semantic version tags for desktop releases.

## [Unreleased]

## [0.0.10] - 2026-07-03

### Added

- Added local folders to Uploads: create, rename, and delete folders, move uploads into them, and browse Drive-style with folder tiles and a breadcrumb.
- Added drag and drop across Uploads: drop image files from the desktop to add them, and drag upload cards (including multi-selections, with a count badge) into folders.
- Added right-click actions to the creative stage hero image and takes: copy image, download image, and reveal in folder.
- Uploads added through Assetwell now keep their original filenames, making search useful.

### Changed

- Uploads now loads the full shared library automatically instead of stopping behind a "Load more" button, so folder counts, search, and brand filters cover everything.
- Upload cards now show the file name and a real upload date on hover.
- The app now notices a completed Higgsfield sign-in on its own instead of waiting for a manual refresh.
- Error messages across the app no longer expose internal technical details.

### Fixed

- Fixed Higgsfield sign-in failing with an OAuth redirect error by pinning the CLI back to 0.2.3.
- Dropping an image outside a drop zone no longer replaces the app window with the image.
- Duplicate folder names are now reported inside the folder dialog instead of a technical toast.

## [0.0.9] - 2026-07-02

### Added

- Added Uploads workspace and brand organization, including filters, search, and shared upload scoping.
- Added Upload image actions to copy, download, copy links, and open images.
- Highlighted newly available Higgsfield models and added scroll affordances to command lists.

### Changed

- Refined video composer controls.
- Documented why Higgsfield Unlimited Generate remains unsupported in Assetwell's CLI-backed integration.

### Fixed

- Hardened Higgsfield readiness checks and dev-only updater/model-detail handling.
- Fixed release asset verification in the release workflow.

## [0.0.8] - 2026-06-30

### Fixed

- Fixed Windows and Linux release packaging so the latest GitHub Release can publish platform installers.

## [0.0.7] - 2026-06-30

### Added

- Added Windows and Linux desktop release publishing alongside macOS.
- Added public Windows and Linux download availability for the latest GitHub Release.

### Changed

- Updated desktop window chrome to use native Windows and Linux titlebars while keeping the custom macOS titlebar.

## [0.0.6] - 2026-06-26

### Added

- Assetwell now shows a friendly in-app "What's New" dialog once per version, using the GitHub release notes for the version you're running.

## [0.0.5] - 2026-06-26

### Changed

- Published a patch release with the refreshed desktop shell and shared placement registry.

## [0.0.4] - 2026-06-26

### Changed

- Published a patch release to validate the titlebar update button.

## [0.0.3] - 2026-06-26

### Added

- Show a titlebar Update button after a packaged app update has downloaded.

## [0.0.2] - 2026-06-26

### Changed

- Published a patch release to validate signed auto-update delivery.

## [0.0.1] - 2026-06-26

### Added

- Initial Assetwell desktop release.
- Desktop CI, release publishing, and packaged-app update foundations.
- Manual Check for Updates menu item backed by the packaged-app updater.
