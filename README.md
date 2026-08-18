# Taskly — To-Do App

## Overview

**Taskly** is a task management web app built as a portfolio project
to practice core JavaScript skills — DOM manipulation, event
handling, and browser storage — without relying on any framework.
It's the third project in my portfolio as a PPLG (Software and Game
Development) student.

🔗 **Live Demo:** [Live Demo](YOUR-LIVE-DEMO-LINK)

> Taskly is a fictional portfolio project created for educational
> purposes.

## Features

- Add, edit, and delete tasks
- Undo delete (and undo "Clear completed") via a toast notification
- Mark tasks complete/incomplete with an animated custom checkbox
- Personalized, time-aware greeting (Good morning/afternoon/evening)
  with an editable name, saved with LocalStorage
- Filter by All / Active / Completed
- Real-time, case-insensitive search
- Sort by Newest / Oldest / Completed
- Data persistence with LocalStorage — nothing is lost on reload
- Light and dark mode, saved as a preference
- Fully responsive, down to 320px-wide screens
- Keyboard shortcut (`Ctrl` / `Cmd` + `K`) to jump to search
- Accessible: semantic HTML, visible focus states, proper labels,
  and safe rendering of user input

## Technologies

- HTML5
- CSS3 (custom properties for theming, Flexbox)
- Vanilla JavaScript (no frameworks or libraries)
- LocalStorage API

## Project Structure

```
taskly-todo-app/
├── index.html
├── style.css
├── script.js
├── assets/
│   └── icons/       # (unused — icons are inline SVG in script.js)
└── README.md
```

## How to Run Locally

No build tools or installation required.

1. Download or clone this repository.
2. Open `index.html` directly in your browser, **or** run a local
   server:

   ```bash
   # Using Python
   python -m http.server 5500

   # Using VS Code
   # Install the "Live Server" extension, then right-click
   # index.html → "Open with Live Server"
   ```

3. Visit `http://localhost:5500`.

## How LocalStorage Works Here

Every task is stored as a plain object:

```js
{
  id: "a1b2c3d4",          // unique ID, never reused as an array index
  title: "Finish portfolio website",
  completed: false,
  createdAt: "2026-08-17T10:00:00.000Z"
}
```

The full task list is saved under the key `taskly:tasks`, the theme
preference under `taskly:theme`, and your display name under
`taskly:userName`. Data is read once on page load (`loadTasks()` /
`loadUserName()`) and written back to LocalStorage every time it
changes (`saveTasks()` / `saveUserName()`). If the saved data is
missing, unreadable, or corrupted, Taskly falls back to safe
defaults (an empty task list, no name set) instead of crashing.

## Screenshots

_Add screenshots here once you've deployed the app, e.g.:_

```
![Desktop view](./assets/icons/screenshot-desktop.png)
![Mobile view](./assets/icons/screenshot-mobile.png)
```

## What I Learned

- Structuring an app's logic into small, single-purpose functions
  (`addTask`, `deleteTask`, `render`, etc.) instead of one big script
- Keeping "data state" (the tasks array) separate from "view state"
  (the current filter, search query, and sort order)
- Reading from and writing to LocalStorage safely, including
  handling corrupted or missing data
- Building filter/search/sort so they only change what's *displayed*
  without ever touching the saved data
- Using `textContent` instead of `innerHTML` for anything that comes
  from user input, to avoid basic XSS
- Implementing an undo pattern with `setTimeout` instead of a
  blocking `confirm()` dialog
- Basic accessibility: labelling every button and input, keeping
  focus states visible, and respecting `prefers-reduced-motion`

## Future Improvements

- Drag-and-drop reordering
- Task categories/tags
- Due dates and reminders
- Browser notifications
- Backend synchronization across devices
- User accounts

## Author

**Muhammad Galil Kurniawan**
PPLG Student · Aspiring Software Developer
Indonesia 🇮🇩
