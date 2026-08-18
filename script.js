/* =========================================================
   Taskly — To-Do App
   Vanilla JavaScript. No frameworks, no build step.

   This file is organized into clearly labeled sections:
   1. Constants & DOM references
   2. State
   3. LocalStorage helpers (load/save)
   4. Task operations (add/update/delete/toggle)
   5. Undo (toast) helpers
   6. Filtering, searching, sorting
   7. Rendering (state -> DOM)
   8. Theme
   9. Greeting
   10. Event listeners & init

   Everything lives inside one IIFE so nothing leaks onto the
   global `window` object.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. Constants & DOM references
  --------------------------------------------------------- */

  const TASKS_STORAGE_KEY = "taskly:tasks";
  const THEME_STORAGE_KEY = "taskly:theme";
  const USER_NAME_STORAGE_KEY = "taskly:userName";
  const UNDO_TIMEOUT_MS = 6000;
  const MAX_NAME_LENGTH = 40;

  // Small, trusted SVG snippets used for icons. These are never
  // combined with user input, so using innerHTML here is safe —
  // task titles are always inserted with textContent (see
  // createTaskElement below).
  const CHECK_ICON_SVG =
    '<svg class="check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const EDIT_ICON_SVG =
    '<svg class="icon" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11.5 3.5l3 3L6 15H3v-3l8.5-8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const DELETE_ICON_SVG =
    '<svg class="icon" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 5.5h10M7.5 5.5V4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6 5.5V14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const greetingHeaderEl = document.getElementById("greetingHeader");

  const addTaskForm = document.getElementById("addTaskForm");
  const taskInput = document.getElementById("taskInput");
  const taskInputMessageEl = document.getElementById("taskInputMessage");

  const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const taskListEl = document.getElementById("taskList");
  const emptyStateEl = document.getElementById("emptyState");
  const emptyStateTitleEl = document.getElementById("emptyStateTitle");
  const emptyStateSubtitleEl = document.getElementById("emptyStateSubtitle");

  const taskCounterEl = document.getElementById("taskCounter");
  const completedCounterEl = document.getElementById("completedCounter");
  const clearCompletedBtn = document.getElementById("clearCompletedBtn");

  const themeToggleBtn = document.getElementById("themeToggle");

  const toastEl = document.getElementById("toast");
  const toastMessageEl = document.getElementById("toastMessage");
  const toastUndoBtn = document.getElementById("toastUndoBtn");

  /* ---------------------------------------------------------
     2. State

     `tasks` is the single source of truth for task data.
     Everything else here is "view state" — it changes what's
     displayed, but never touches the saved task data.
  --------------------------------------------------------- */

  let tasks = [];
  let currentFilter = "all"; // "all" | "active" | "completed"
  let currentSort = "newest"; // "newest" | "oldest" | "completed"
  let searchQuery = "";
  let editingTaskId = null;
  let editErrorMessage = "";
  let undoTimeoutId = null;
  let toastHideTimeoutId = null;
  let userName = "";
  let isEditingName = false;

  /* ---------------------------------------------------------
     3. LocalStorage helpers
  --------------------------------------------------------- */

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    // Fallback for older browsers: timestamp + random string.
    return "task-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function isValidTask(value) {
    return (
      value &&
      typeof value === "object" &&
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      typeof value.completed === "boolean" &&
      typeof value.createdAt === "string"
    );
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(TASKS_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Drop any entries that don't look like a real task instead
      // of letting one bad entry break the whole app.
      return parsed.filter(isValidTask);
    } catch (error) {
      console.error("Taskly: could not load saved tasks.", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Taskly: could not save tasks.", error);
      showToast("Your changes couldn't be saved right now.");
    }
  }

  /* ---------------------------------------------------------
     4. Task operations
  --------------------------------------------------------- */

  function addTask(rawTitle) {
    const title = rawTitle.trim();

    if (!title) {
      showInputMessage("Please enter a task before adding.");
      return;
    }

    const isDuplicate = tasks.some(
      (task) => task.title.toLowerCase() === title.toLowerCase()
    );
    if (isDuplicate) {
      showInputMessage("This task already exists.");
      return;
    }

    const newTask = {
      id: generateId(),
      title: title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    tasks.unshift(newTask);
    saveTasks();
    clearInputMessage();
    render();
  }

  function toggleTaskComplete(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function startEditingTask(id) {
    editingTaskId = id;
    editErrorMessage = "";
    render();

    const input = taskListEl.querySelector(".task-edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function cancelEditingTask() {
    editingTaskId = null;
    editErrorMessage = "";
    render();
  }

  function saveEditedTask(id, rawTitle) {
    const title = rawTitle.trim();

    if (!title) {
      editErrorMessage = "Task can't be empty.";
      render();
      return;
    }

    const isDuplicate = tasks.some(
      (task) => task.id !== id && task.title.toLowerCase() === title.toLowerCase()
    );
    if (isDuplicate) {
      editErrorMessage = "This task already exists.";
      render();
      return;
    }

    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.title = title;
    editingTaskId = null;
    editErrorMessage = "";
    saveTasks();
    render();
  }

  function deleteTask(id) {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return;

    const [removedTask] = tasks.splice(index, 1);
    saveTasks();
    render();

    showUndoToast('Task deleted.', () => {
      // Simplification: this puts the task back at its original
      // index. If other edits happened in the meantime, that
      // position may have shifted slightly — an acceptable
      // trade-off for keeping undo simple.
      tasks.splice(index, 0, removedTask);
      saveTasks();
      render();
    });
  }

  function clearCompletedTasks() {
    const removedTasks = tasks.filter((t) => t.completed);
    if (removedTasks.length === 0) return;

    tasks = tasks.filter((t) => !t.completed);
    saveTasks();
    render();

    const message =
      removedTasks.length === 1
        ? "1 completed task cleared."
        : removedTasks.length + " completed tasks cleared.";

    showUndoToast(message, () => {
      // Merge the removed tasks back into whatever `tasks` currently
      // is (rather than restoring a stale snapshot), so nothing added
      // in the meantime gets lost.
      tasks = tasks.concat(removedTasks);
      saveTasks();
      render();
    });
  }

  /* ---------------------------------------------------------
     5. Undo (toast) helpers
  --------------------------------------------------------- */

  function showUndoToast(message, onUndo) {
    clearTimeout(undoTimeoutId);

    toastMessageEl.textContent = message;
    toastUndoBtn.hidden = false;
    toastUndoBtn.onclick = function () {
      onUndo();
      hideToast();
    };

    revealToast();
  }

  function showToast(message) {
    clearTimeout(undoTimeoutId);

    toastMessageEl.textContent = message;
    toastUndoBtn.hidden = true;
    toastUndoBtn.onclick = null;

    revealToast();
  }

  function revealToast() {
    // Cancel any pending "fully hide" from a previous toast so it
    // doesn't hide this new one out from under the user.
    clearTimeout(toastHideTimeoutId);

    toastEl.hidden = false;
    // Wait a frame so the browser registers the starting state
    // before we animate to the visible state.
    requestAnimationFrame(() => {
      toastEl.classList.add("is-visible");
    });
    undoTimeoutId = setTimeout(hideToast, UNDO_TIMEOUT_MS);
  }

  function hideToast() {
    clearTimeout(undoTimeoutId);
    toastEl.classList.remove("is-visible");
    toastHideTimeoutId = setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }

  /* ---------------------------------------------------------
     6. Filtering, searching, sorting

     These only ever affect what getVisibleTasks() returns for
     display — they never modify the `tasks` array itself.
  --------------------------------------------------------- */

  function getVisibleTasks() {
    let result = tasks.slice();

    if (currentFilter === "active") {
      result = result.filter((t) => !t.completed);
    } else if (currentFilter === "completed") {
      result = result.filter((t) => t.completed);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      if (currentSort === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (currentSort === "completed") {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      // "newest" (default)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return result;
  }

  /* ---------------------------------------------------------
     7. Rendering (state -> DOM)
  --------------------------------------------------------- */

  function render() {
    const visibleTasks = getVisibleTasks();
    renderTaskList(visibleTasks);
    renderEmptyState(visibleTasks);
    renderCounters();
    renderClearCompletedButton();
  }

  function renderTaskList(visibleTasks) {
    taskListEl.textContent = "";
    visibleTasks.forEach((task) => {
      taskListEl.appendChild(createTaskElement(task));
    });
  }

  function createTaskElement(task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " is-completed" : "");
    li.dataset.id = task.id;

    if (editingTaskId === task.id) {
      li.appendChild(createEditModeContent(task));
      return li;
    }

    // --- Checkbox ---
    const checkboxWrap = document.createElement("label");
    checkboxWrap.className = "task-checkbox-wrap";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute(
      "aria-label",
      'Mark "' + task.title + '" as ' + (task.completed ? "not completed" : "completed")
    );
    checkbox.addEventListener("change", () => toggleTaskComplete(task.id));

    const checkboxVisual = document.createElement("span");
    checkboxVisual.className = "task-checkbox-visual";
    checkboxVisual.innerHTML = CHECK_ICON_SVG;

    checkboxWrap.appendChild(checkbox);
    checkboxWrap.appendChild(checkboxVisual);

    // --- Title (always textContent — never innerHTML — for safety) ---
    const titleEl = document.createElement("span");
    titleEl.className = "task-title";
    titleEl.textContent = task.title;

    // --- Actions ---
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn task-edit-btn";
    editBtn.setAttribute("aria-label", 'Edit "' + task.title + '"');
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.addEventListener("click", () => startEditingTask(task.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn task-delete-btn";
    deleteBtn.setAttribute("aria-label", 'Delete "' + task.title + '"');
    deleteBtn.innerHTML = DELETE_ICON_SVG;
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkboxWrap);
    li.appendChild(titleEl);
    li.appendChild(actions);

    return li;
  }

  function createEditModeContent(task) {
    const fragment = document.createDocumentFragment();

    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit-input";
    input.value = task.title;
    input.maxLength = 200;
    input.setAttribute("aria-label", "Edit task title");

    const actions = document.createElement("div");
    actions.className = "task-edit-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn task-edit-save";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn task-edit-cancel";
    cancelBtn.textContent = "Cancel";

    const commitEdit = () => saveEditedTask(task.id, input.value);
    saveBtn.addEventListener("click", commitEdit);
    cancelBtn.addEventListener("click", cancelEditingTask);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingTask();
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    fragment.appendChild(input);
    fragment.appendChild(actions);

    if (editErrorMessage) {
      const errorEl = document.createElement("span");
      errorEl.className = "edit-error";
      errorEl.setAttribute("role", "alert");
      errorEl.textContent = editErrorMessage;
      fragment.appendChild(errorEl);
    }

    return fragment;
  }

  function renderEmptyState(visibleTasks) {
    if (visibleTasks.length > 0) {
      emptyStateEl.hidden = true;
      taskListEl.hidden = false;
      return;
    }

    taskListEl.hidden = true;
    emptyStateEl.hidden = false;

    const hasAnyTasks = tasks.length > 0;
    const isSearching = searchQuery.trim().length > 0;

    if (!hasAnyTasks) {
      emptyStateTitleEl.textContent = "You're all caught up.";
      emptyStateSubtitleEl.textContent = "Add a task to get started.";
    } else if (isSearching) {
      emptyStateTitleEl.textContent = "No tasks found.";
      emptyStateSubtitleEl.textContent = "Try a different search term.";
    } else if (currentFilter === "active") {
      emptyStateTitleEl.textContent = "No active tasks.";
      emptyStateSubtitleEl.textContent = "Everything is completed — nice work.";
    } else if (currentFilter === "completed") {
      emptyStateTitleEl.textContent = "No completed tasks yet.";
      emptyStateSubtitleEl.textContent = "Complete a task to see it here.";
    } else {
      emptyStateTitleEl.textContent = "No tasks found.";
      emptyStateSubtitleEl.textContent = "Try a different search or filter.";
    }
  }

  function renderCounters() {
    const remaining = tasks.filter((t) => !t.completed).length;
    const completed = tasks.length - remaining;

    taskCounterEl.textContent =
      remaining + (remaining === 1 ? " task remaining" : " tasks remaining");
    completedCounterEl.textContent =
      completed + (completed === 1 ? " completed" : " completed");
  }

  function renderClearCompletedButton() {
    const hasCompleted = tasks.some((t) => t.completed);
    clearCompletedBtn.hidden = !hasCompleted;
  }

  function showInputMessage(message) {
    taskInputMessageEl.textContent = message;
    taskInput.setAttribute("aria-invalid", "true");
  }

  function clearInputMessage() {
    taskInputMessageEl.textContent = "";
    taskInput.removeAttribute("aria-invalid");
  }

  /* ---------------------------------------------------------
     8. Theme
  --------------------------------------------------------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("Taskly: could not save theme preference.", error);
    }

    themeToggleBtn.setAttribute("aria-pressed", String(theme === "light"));
    themeToggleBtn.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  function toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ---------------------------------------------------------
     9. Greeting & user name

     The user's name is stored separately from tasks/theme so it
     survives independently. If nothing is saved yet, the app opens
     straight into the "add your name" input instead of guessing.
  --------------------------------------------------------- */

  function loadUserName() {
    try {
      return localStorage.getItem(USER_NAME_STORAGE_KEY) || "";
    } catch (error) {
      console.error("Taskly: could not load the saved name.", error);
      return "";
    }
  }

  function saveUserName(name) {
    try {
      localStorage.setItem(USER_NAME_STORAGE_KEY, name);
    } catch (error) {
      console.error("Taskly: could not save the name.", error);
    }
  }

  function getGreetingLabel() {
    const hour = new Date().getHours();

    if (hour >= 12 && hour < 18) return "Good afternoon";
    if (hour >= 18 || hour < 5) return "Good evening";
    return "Good morning";
  }

  function startEditingName() {
    isEditingName = true;
    renderGreeting();

    const input = document.getElementById("nameInput");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function cancelEditingName() {
    isEditingName = false;
    renderGreeting();
  }

  function saveNameFromInput(rawName) {
    userName = rawName.trim().slice(0, MAX_NAME_LENGTH);
    saveUserName(userName);
    isEditingName = false;
    renderGreeting();
  }

  function renderGreeting() {
    greetingHeaderEl.textContent = "";

    if (isEditingName) {
      greetingHeaderEl.appendChild(createNameEditForm());
      return;
    }

    const heading = document.createElement("h1");
    heading.className = "greeting-text";
    heading.textContent =
      getGreetingLabel() + (userName ? ", " + userName : "") + " \u{1F44B}";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn greeting-edit-btn";
    editBtn.setAttribute("aria-label", userName ? "Edit your name" : "Add your name");
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.addEventListener("click", startEditingName);

    greetingHeaderEl.appendChild(heading);
    greetingHeaderEl.appendChild(editBtn);
  }

  function createNameEditForm() {
    const fragment = document.createDocumentFragment();

    const label = document.createElement("span");
    label.className = "greeting-label-static";
    label.textContent = getGreetingLabel() + ",";

    const input = document.createElement("input");
    input.type = "text";
    input.id = "nameInput";
    input.className = "greeting-name-input";
    input.placeholder = "Your name";
    input.maxLength = MAX_NAME_LENGTH;
    input.value = userName;
    input.setAttribute("aria-label", "Your name");

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn task-edit-save";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn task-edit-cancel";
    cancelBtn.textContent = "Cancel";

    const commitName = () => saveNameFromInput(input.value);
    saveBtn.addEventListener("click", commitName);
    cancelBtn.addEventListener("click", cancelEditingName);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitName();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditingName();
      }
    });

    fragment.appendChild(label);
    fragment.appendChild(input);
    fragment.appendChild(saveBtn);
    fragment.appendChild(cancelBtn);

    return fragment;
  }

  /* ---------------------------------------------------------
     10. Event listeners & init
  --------------------------------------------------------- */

  addTaskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(taskInput.value);
    taskInput.value = "";
    taskInput.focus();
  });

  taskInput.addEventListener("input", () => {
    if (taskInput.getAttribute("aria-invalid") === "true") {
      clearInputMessage();
    }
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      filterButtons.forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      render();
    });
  });

  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    currentSort = event.target.value;
    render();
  });

  clearCompletedBtn.addEventListener("click", clearCompletedTasks);

  themeToggleBtn.addEventListener("click", toggleTheme);

  // Ctrl/Cmd + K focuses the search field. Ignored on mobile since
  // there's no hardware keyboard to trigger it from.
  document.addEventListener("keydown", (event) => {
    const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    if (isShortcut) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  function init() {
    tasks = loadTasks();
    userName = loadUserName();

    // First visit (no name saved yet): open straight into the
    // name input instead of showing a greeting with nobody's name.
    if (!userName) {
      isEditingName = true;
    }
    renderGreeting();

    // The <head> script already set data-theme before first paint;
    // this just syncs the toggle button's ARIA state to match.
    const initialTheme = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(initialTheme);

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
