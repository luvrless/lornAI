/**
 * lornAI - Main Application Engine
 * Claude UI design, Autonomous Multi-Model Routing, Puter.js integration,
 * Live Code Artifacts Sandbox, and Secure Local-Only Key Storage.
 * 
 * ZERO KEYS ARE HARDCODED OR LEAKED. All private credentials exist
 * strictly in the user's local browser memory.
 */

// Models mapping lorn series to intelligent engines
const MODEL_REGISTRY = {
  "lorn-dts-5.0": {
    name: "lorn dts 5.0",
    badge: "Flagship",
    badgeClass: "flagship",
    description: "State-of-the-art reasoning, deep coding, Claude 3.5/5.5 Sonnet tier",
    cloudModel: "openai",
    puterModel: "claude-sonnet-5-5"
  },
  "lorn-dts-4.5": {
    name: "lorn dts 4.5",
    badge: "Ultra",
    badgeClass: "smart",
    description: "Advanced analysis, creative writing, and complex multi-turn logic",
    cloudModel: "openai",
    puterModel: "claude-3-5-sonnet"
  },
  "lorn-dts-4.0": {
    name: "lorn dts 4.0",
    badge: "Pro",
    badgeClass: "smart",
    description: "Balanced high-precision synthesis and coding support",
    cloudModel: "claude",
    puterModel: "claude-3-sonnet"
  },
  "lorn-dts-3.5": {
    name: "lorn dts 3.5",
    badge: "Standard",
    badgeClass: "fast",
    description: "Fast and intelligent daily assistant with strong general capability",
    cloudModel: "openai",
    puterModel: "openai/gpt-4o-mini"
  },
  "lorn-light-4.5": {
    name: "lorn light 4.5",
    badge: "Turbo",
    badgeClass: "light",
    description: "Blazing fast response times with high conversational fluency",
    cloudModel: "deepseek",
    puterModel: "deepseek-chat"
  },
  "lorn-light-3.5": {
    name: "lorn light 3.5",
    badge: "Light",
    badgeClass: "light",
    description: "Optimized for quick answers, translations, and summarization",
    cloudModel: "mistral",
    puterModel: "openai/gpt-5.4-nano"
  },
  "lorn-light-2.5": {
    name: "lorn light 2.5",
    badge: "Nano",
    badgeClass: "nano",
    description: "Ultra-compact, low-footprint fast conversational replies",
    cloudModel: "qwen",
    puterModel: "openai/gpt-5.4-nano"
  },
  "lorn-light-1.5": {
    name: "lorn light 1.5",
    badge: "Micro",
    badgeClass: "nano",
    description: "Instantaneous micro-model for lightweight interactions",
    cloudModel: "mistral",
    puterModel: "google/gemma-2b"
  }
};

class LornAIEngine {
  constructor() {
    this.conversations = JSON.parse(localStorage.getItem("lorn_conversations") || "[]");
    this.currentConvId = localStorage.getItem("lorn_active_conv") || null;
    this.selectedModelKey = localStorage.getItem("lorn_selected_model") || "lorn-dts-5.0";
    this.currentKeyIndex = parseInt(localStorage.getItem("lorn_key_index") || "0", 10);
    this.isGenerating = false;
    this.activeArtifacts = [];
    this.pendingAttachments = [];
    this.thinkingMode = true;

    // Load Settings from LocalStorage ONLY (Zero hardcoded secrets)
    this.settings = {
      defaultModel: localStorage.getItem("lorn_setting_model") || "lorn-dts-5.0",
      temperature: parseFloat(localStorage.getItem("lorn_setting_temp") || "0.75"),
      autoFailover: localStorage.getItem("lorn_setting_failover") !== "false",
      autoOpenArtifacts: localStorage.getItem("lorn_setting_auto_artifacts") !== "false",
      nvidiaKey: localStorage.getItem("lorn_nvidia_key") || "",
      keyPool: JSON.parse(localStorage.getItem("lorn_key_pool") || "[]"),
      systemPrompt: localStorage.getItem("lorn_system_prompt") || `You are lornAI, an advanced, highly intelligent AI assistant crafted in the design, intellectual depth, and articulate style of Claude. You communicate with warmth, nuance, structured clarity, and conversational naturalness.

You can freely talk about anything: daily conversation, philosophy, writing, code, logic, and creative ideas. You speak with human-like warmth and genuine interest in the user's thoughts.

When generating code, provide complete, clean, modular code. If writing web components or UI, format them clearly in HTML/CSS/JavaScript or SVG blocks so they can be rendered in the lornAI live Artifacts viewer.`
    };

    this.initDOM();
    this.bindEvents();
    this.renderHistory();
    this.loadActiveConversation();
    this.updateGreeting();
  }

  // ==========================================
  // DOM & UI Initialization
  // ==========================================
  initDOM() {
    this.dom = {
      app: document.getElementById("app"),
      sidebar: document.getElementById("sidebar"),
      sidebarToggleBtn: document.getElementById("sidebar-toggle-btn"),
      mobileSidebarToggle: document.getElementById("mobile-sidebar-toggle"),
      sidebarOverlay: document.getElementById("sidebar-overlay"),
      newChatBtn: document.getElementById("new-chat-btn"),
      chatSearch: document.getElementById("chat-search"),
      historyContainer: document.getElementById("history-container"),
      activeEngineLabel: document.getElementById("active-engine-label"),
      settingsBtn: document.getElementById("settings-btn"),
      themeToggleBtn: document.getElementById("theme-toggle-btn"),
      themeIcon: document.getElementById("theme-icon"),

      modelPickerWrap: document.getElementById("model-picker-wrap"),
      modelPickerTrigger: document.getElementById("model-picker-trigger"),
      currentModelDisplay: document.getElementById("current-model-display"),
      currentModelTag: document.getElementById("current-model-tag"),
      modelDropdownMenu: document.getElementById("model-dropdown-menu"),

      toggleArtifactsBtn: document.getElementById("toggle-artifacts-btn"),
      artifactsCounter: document.getElementById("artifacts-counter"),
      clearChatBtn: document.getElementById("clear-chat-btn"),

      chatViewport: document.getElementById("chat-viewport"),
      heroWelcome: document.getElementById("hero-welcome"),
      heroGreeting: document.getElementById("hero-greeting"),
      messagesContainer: document.getElementById("messages-container"),

      fallbackNotification: document.getElementById("fallback-notification"),
      fallbackText: document.getElementById("fallback-text"),

      inputCard: document.getElementById("input-card"),
      chatTextarea: document.getElementById("chat-textarea"),
      fileUploadInput: document.getElementById("file-upload-input"),
      attachFileBtn: document.getElementById("attach-file-btn"),
      attachmentsPreview: document.getElementById("attachments-preview"),
      quickModelPill: document.getElementById("quick-model-pill"),
      pillModelName: document.getElementById("pill-model-name"),
      reasoningToggleBtn: document.getElementById("reasoning-toggle-btn"),
      charCounter: document.getElementById("char-counter"),
      sendMessageBtn: document.getElementById("send-message-btn"),

      artifactsDrawer: document.getElementById("artifacts-drawer"),
      artifactTitle: document.getElementById("artifact-title"),
      artifactSubtitle: document.getElementById("artifact-subtitle"),
      artifactCopyBtn: document.getElementById("artifact-copy-btn"),
      artifactDownloadBtn: document.getElementById("artifact-download-btn"),
      closeArtifactsBtn: document.getElementById("close-artifacts-btn"),
      tabCodeBtn: document.getElementById("tab-code-btn"),
      tabPreviewBtn: document.getElementById("tab-preview-btn"),
      artifactCodeView: document.getElementById("artifact-code-view"),
      artifactPreviewView: document.getElementById("artifact-preview-view"),
      artifactCodeBlock: document.getElementById("artifact-code-block"),
      artifactPreviewIframe: document.getElementById("artifact-preview-iframe"),

      // Settings Modal
      settingsModal: document.getElementById("settings-modal"),
      closeSettingsBtn: document.getElementById("close-settings-btn"),
      saveSettingsBtn: document.getElementById("save-settings-btn"),
      settingDefaultModel: document.getElementById("setting-default-model"),
      settingTemperature: document.getElementById("setting-temperature"),
      tempVal: document.getElementById("temp-val"),
      settingAutofailover: document.getElementById("setting-autofailover"),
      settingAutoopenArtifacts: document.getElementById("setting-autoopen-artifacts"),
      nvidiaKeyInput: document.getElementById("nvidia-key-input"),
      toggleNvidiaKey: document.getElementById("toggle-nvidia-key"),
      keyPoolTextarea: document.getElementById("key-pool-textarea"),
      keyPoolCount: document.getElementById("key-pool-count"),
      clearKeysBtn: document.getElementById("clear-keys-btn"),
      customSystemPrompt: document.getElementById("custom-system-prompt")
    };

    // Apply Saved Theme
    const savedTheme = localStorage.getItem("lorn_theme") || "light";
    document.body.className = `theme-${savedTheme}`;
    this.updateThemeIcon(savedTheme);

    // Apply Selected Model
    this.applySelectedModel(this.selectedModelKey);
  }

  bindEvents() {
    // Sidebar Toggling
    this.dom.sidebarToggleBtn.addEventListener("click", () => this.toggleSidebar());
    this.dom.mobileSidebarToggle.addEventListener("click", () => this.toggleSidebar(true));
    this.dom.sidebarOverlay.addEventListener("click", () => this.closeMobileSidebar());

    // New Chat & Clear
    this.dom.newChatBtn.addEventListener("click", () => this.createNewConversation());
    this.dom.clearChatBtn.addEventListener("click", () => this.clearCurrentConversation());

    // Search History
    this.dom.chatSearch.addEventListener("input", (e) => this.filterHistory(e.target.value));

    // Theme Toggle
    this.dom.themeToggleBtn.addEventListener("click", () => this.toggleTheme());

    // Model Picker Dropdown
    this.dom.modelPickerTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.modelPickerWrap.classList.toggle("open");
    });
    this.dom.quickModelPill.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.modelPickerWrap.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!this.dom.modelPickerWrap.contains(e.target)) {
        this.dom.modelPickerWrap.classList.remove("open");
      }
    });

    // Model Selection Options
    document.querySelectorAll(".model-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        const modelId = opt.getAttribute("data-model");
        this.applySelectedModel(modelId);
        this.dom.modelPickerWrap.classList.remove("open");
      });
    });

    // Prompt Starters
    document.querySelectorAll(".starter-card").forEach(card => {
      card.addEventListener("click", () => {
        const prompt = card.getAttribute("data-prompt");
        this.dom.chatTextarea.value = prompt;
        this.handleTextareaInput();
        this.handleSendMessage();
      });
    });

    // Input Handling
    this.dom.chatTextarea.addEventListener("input", () => this.handleTextareaInput());
    this.dom.chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Global Shortcut: Ctrl+K or Cmd+K
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.createNewConversation();
      }
    });

    this.dom.sendMessageBtn.addEventListener("click", () => this.handleSendMessage());

    // File Attachment
    this.dom.attachFileBtn.addEventListener("click", () => this.dom.fileUploadInput.click());
    this.dom.fileUploadInput.addEventListener("change", (e) => this.handleFileUpload(e));

    // Thinking Mode Toggle
    this.dom.reasoningToggleBtn.addEventListener("click", () => {
      this.thinkingMode = !this.thinkingMode;
      this.dom.reasoningToggleBtn.classList.toggle("active", this.thinkingMode);
    });

    // Artifacts Drawer
    this.dom.toggleArtifactsBtn.addEventListener("click", () => this.toggleArtifactsDrawer());
    this.dom.closeArtifactsBtn.addEventListener("click", () => this.closeArtifactsDrawer());
    this.dom.tabCodeBtn.addEventListener("click", () => this.switchArtifactTab("code"));
    this.dom.tabPreviewBtn.addEventListener("click", () => this.switchArtifactTab("preview"));
    this.dom.artifactCopyBtn.addEventListener("click", () => this.copyArtifactCode());
    this.dom.artifactDownloadBtn.addEventListener("click", () => this.downloadArtifactCode());

    // Settings Modal
    this.dom.settingsBtn.addEventListener("click", () => this.openSettingsModal());
    this.dom.closeSettingsBtn.addEventListener("click", () => this.closeSettingsModal());
    this.dom.saveSettingsBtn.addEventListener("click", () => this.saveSettings());
    this.dom.clearKeysBtn.addEventListener("click", () => {
      this.dom.keyPoolTextarea.value = "";
      this.dom.keyPoolCount.textContent = "0";
    });
    this.dom.toggleNvidiaKey.addEventListener("click", () => {
      const type = this.dom.nvidiaKeyInput.type === "password" ? "text" : "password";
      this.dom.nvidiaKeyInput.type = type;
    });

    this.dom.settingTemperature.addEventListener("input", (e) => {
      this.dom.tempVal.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Settings Tabs
    const settingTabs = document.querySelectorAll(".settings-tab-btn");
    settingTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        settingTabs.forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const tabId = btn.getAttribute("data-tab");
        document.getElementById(`tab-${tabId}`).classList.add("active");
      });
    });
  }

  // ==========================================
  // Layout & UI Helpers
  // ==========================================
  updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good afternoon";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour > 18) timeGreeting = "Good evening";
    this.dom.heroGreeting.textContent = `${timeGreeting}, Friend.`;
  }

  toggleSidebar(isMobile = false) {
    if (isMobile) {
      this.dom.sidebar.classList.toggle("collapsed");
      this.dom.sidebarOverlay.classList.toggle("hidden");
    } else {
      this.dom.sidebar.classList.toggle("collapsed");
    }
  }

  closeMobileSidebar() {
    this.dom.sidebar.classList.add("collapsed");
    this.dom.sidebarOverlay.classList.add("hidden");
  }

  toggleTheme() {
    const isDark = document.body.classList.contains("theme-dark");
    const nextTheme = isDark ? "light" : "dark";
    document.body.className = `theme-${nextTheme}`;
    localStorage.setItem("lorn_theme", nextTheme);
    this.updateThemeIcon(nextTheme);
  }

  updateThemeIcon(theme) {
    if (theme === "dark") {
      this.dom.themeIcon.className = "fa-solid fa-moon";
    } else {
      this.dom.themeIcon.className = "fa-regular fa-sun";
    }
  }

  applySelectedModel(modelKey) {
    if (!MODEL_REGISTRY[modelKey]) modelKey = "lorn-dts-5.0";
    this.selectedModelKey = modelKey;
    localStorage.setItem("lorn_selected_model", modelKey);

    const model = MODEL_REGISTRY[modelKey];
    this.dom.currentModelDisplay.textContent = model.name;
    this.dom.currentModelTag.textContent = model.badge;
    this.dom.pillModelName.textContent = model.name;

    document.querySelectorAll(".model-opt").forEach(opt => {
      if (opt.getAttribute("data-model") === modelKey) {
        opt.classList.add("active");
      } else {
        opt.classList.remove("active");
      }
    });
  }

  handleTextareaInput() {
    const textarea = this.dom.chatTextarea;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";

    const text = textarea.value.trim();
    const hasAttachments = this.pendingAttachments.length > 0;
    this.dom.sendMessageBtn.disabled = (!text && !hasAttachments) || this.isGenerating;
    this.dom.sendMessageBtn.classList.toggle("active", (text.length > 0 || hasAttachments) && !this.isGenerating);
    this.dom.charCounter.textContent = text.length > 0 ? `${text.length} chars` : "";
  }

  handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      const isImg = file.type.startsWith("image/");

      if (isImg) {
        reader.readAsDataURL(file);
        reader.onload = () => {
          this.pendingAttachments.push({
            name: file.name,
            type: "image",
            data: reader.result
          });
          this.renderAttachmentsPreview();
        };
      } else {
        reader.readAsText(file);
        reader.onload = () => {
          this.pendingAttachments.push({
            name: file.name,
            type: "text",
            data: reader.result
          });
          this.renderAttachmentsPreview();
        };
      }
    });

    e.target.value = "";
  }

  renderAttachmentsPreview() {
    const container = this.dom.attachmentsPreview;
    container.innerHTML = "";
    if (this.pendingAttachments.length === 0) {
      container.classList.add("hidden");
      this.handleTextareaInput();
      return;
    }

    container.classList.remove("hidden");
    this.pendingAttachments.forEach((att, idx) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";
      const icon = att.type === "image" ? '<i class="fa-regular fa-image"></i>' : '<i class="fa-regular fa-file-code"></i>';
      chip.innerHTML = `
        ${icon}
        <span>${this.escapeHtml(att.name)}</span>
        <i class="fa-solid fa-xmark remove-file" data-idx="${idx}"></i>
      `;
      chip.querySelector(".remove-file").addEventListener("click", () => {
        this.pendingAttachments.splice(idx, 1);
        this.renderAttachmentsPreview();
      });
      container.appendChild(chip);
    });

    this.handleTextareaInput();
  }

  // ==========================================
  // Conversation History
  // ==========================================
  createNewConversation() {
    const newConv = {
      id: "conv_" + Date.now(),
      title: "New Conversation",
      model: this.selectedModelKey,
      timestamp: Date.now(),
      messages: []
    };

    this.conversations.unshift(newConv);
    this.currentConvId = newConv.id;
    this.saveConversations();
    this.renderHistory();
    this.renderMessages();
    this.dom.chatTextarea.focus();
    if (window.innerWidth < 768) this.closeMobileSidebar();
  }

  clearCurrentConversation() {
    const conv = this.getActiveConversation();
    if (!conv) return;
    if (confirm("Clear this conversation?")) {
      conv.messages = [];
      this.activeArtifacts = [];
      this.updateArtifactsBadge();
      this.saveConversations();
      this.renderMessages();
    }
  }

  getActiveConversation() {
    if (!this.currentConvId && this.conversations.length > 0) {
      this.currentConvId = this.conversations[0].id;
    }
    return this.conversations.find(c => c.id === this.currentConvId) || null;
  }

  saveConversations() {
    localStorage.setItem("lorn_conversations", JSON.stringify(this.conversations));
    if (this.currentConvId) {
      localStorage.setItem("lorn_active_conv", this.currentConvId);
    }
  }

  renderHistory() {
    const container = this.dom.historyContainer;
    container.innerHTML = "";

    if (this.conversations.length === 0) {
      container.innerHTML = '<div style="padding:16px 10px;font-size:0.8rem;color:var(--text-muted);text-align:center;">No previous conversations</div>';
      return;
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const groups = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: []
    };

    this.conversations.forEach(c => {
      const diff = now - (c.timestamp || now);
      if (diff < oneDay) groups.Today.push(c);
      else if (diff < 2 * oneDay) groups.Yesterday.push(c);
      else if (diff < 7 * oneDay) groups["Previous 7 Days"].push(c);
      else groups.Older.push(c);
    });

    Object.entries(groups).forEach(([title, convs]) => {
      if (convs.length === 0) return;

      const groupHeader = document.createElement("div");
      groupHeader.className = "history-group-title";
      groupHeader.textContent = title;
      container.appendChild(groupHeader);

      convs.forEach(c => {
        const item = document.createElement("div");
        item.className = `history-item ${c.id === this.currentConvId ? "active" : ""}`;
        item.innerHTML = `
          <span class="title-text">${this.escapeHtml(c.title)}</span>
          <div class="item-actions">
            <button class="item-action-btn edit-title" title="Rename"><i class="fa-solid fa-pen"></i></button>
            <button class="item-action-btn delete-conv" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;

        item.addEventListener("click", (e) => {
          if (e.target.closest(".item-action-btn")) return;
          this.currentConvId = c.id;
          this.saveConversations();
          this.renderHistory();
          this.renderMessages();
          if (window.innerWidth < 768) this.closeMobileSidebar();
        });

        // Edit Title
        item.querySelector(".edit-title").addEventListener("click", (e) => {
          e.stopPropagation();
          const newTitle = prompt("Enter new title:", c.title);
          if (newTitle && newTitle.trim()) {
            c.title = newTitle.trim();
            this.saveConversations();
            this.renderHistory();
          }
        });

        // Delete Conversation
        item.querySelector(".delete-conv").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Delete this conversation?")) {
            this.conversations = this.conversations.filter(x => x.id !== c.id);
            if (this.currentConvId === c.id) {
              this.currentConvId = this.conversations.length > 0 ? this.conversations[0].id : null;
            }
            this.saveConversations();
            this.renderHistory();
            this.renderMessages();
          }
        });

        container.appendChild(item);
      });
    });
  }

  filterHistory(query) {
    const q = query.toLowerCase().trim();
    const items = this.dom.historyContainer.querySelectorAll(".history-item");
    items.forEach(el => {
      const text = el.querySelector(".title-text").textContent.toLowerCase();
      el.style.display = text.includes(q) ? "flex" : "none";
    });
  }

  loadActiveConversation() {
    if (this.conversations.length === 0) {
      this.createNewConversation();
    } else {
      this.renderMessages();
    }
  }

  renderMessages() {
    const conv = this.getActiveConversation();
    const container = this.dom.messagesContainer;
    container.innerHTML = "";
    this.activeArtifacts = [];

    if (!conv || conv.messages.length === 0) {
      this.dom.heroWelcome.classList.remove("hidden");
      this.updateArtifactsBadge();
      return;
    }

    this.dom.heroWelcome.classList.add("hidden");

    conv.messages.forEach((msg, idx) => {
      this.appendMessageToDOM(msg, idx);
    });

    this.updateArtifactsBadge();
    this.scrollToBottom();
  }

  appendMessageToDOM(msg, idx) {
    const row = document.createElement("div");
    row.className = `message-row ${msg.role}`;
    row.dataset.msgIdx = idx;

    if (msg.role === "user") {
      let attachmentsHtml = "";
      if (msg.attachments && msg.attachments.length > 0) {
        attachmentsHtml = `
          <div class="user-attachments" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            ${msg.attachments.map(att => att.type === "image" 
              ? `<img src="${att.data}" style="max-height:120px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">` 
              : `<span class="attachment-chip"><i class="fa-regular fa-file"></i> ${this.escapeHtml(att.name)}</span>`
            ).join("")}
          </div>
        `;
      }

      row.innerHTML = `
        <div class="message-bubble">
          ${attachmentsHtml}
          <div class="message-body">${this.escapeHtml(msg.content).replace(/\n/g, "<br>")}</div>
        </div>
      `;
    } else {
      const formattedHtml = this.parseMarkdown(msg.content);
      const modelName = msg.model || this.selectedModelKey;

      row.innerHTML = `
        <div class="assistant-avatar">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="assistant-content-wrap">
          <div class="assistant-meta">
            <span class="meta-model-tag">✦ ${modelName}</span>
            <span>•</span>
            <span>${this.formatTime(msg.timestamp || Date.now())}</span>
            ${msg.fallbackProvider ? `<span style="color:#D97706;"><i class="fa-solid fa-shield-halved"></i> via ${msg.fallbackProvider}</span>` : ""}
          </div>
          <div class="message-body">${formattedHtml}</div>
          <div class="message-actions">
            <button class="action-pill-btn copy-msg-btn" title="Copy text"><i class="fa-regular fa-copy"></i> Copy</button>
            <button class="action-pill-btn regen-msg-btn" title="Retry"><i class="fa-solid fa-arrows-rotate"></i> Retry</button>
          </div>
        </div>
      `;

      row.querySelector(".copy-msg-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(msg.content);
        const btn = row.querySelector(".copy-msg-btn");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        }, 2000);
      });

      row.querySelector(".regen-msg-btn").addEventListener("click", () => {
        this.regenerateResponse(idx);
      });

      this.extractArtifactsFromMessage(msg.content, row);
    }

    this.dom.messagesContainer.appendChild(row);

    row.querySelectorAll("pre code").forEach(block => {
      if (typeof hljs !== "undefined") hljs.highlightElement(block);
    });
  }

  scrollToBottom() {
    this.dom.chatViewport.scrollTo({
      top: this.dom.chatViewport.scrollHeight,
      behavior: "smooth"
    });
  }

  // ==========================================
  // Markdown & Artifacts
  // ==========================================
  parseMarkdown(text) {
    if (typeof marked !== "undefined") {
      return marked.parse(text);
    }
    return this.escapeHtml(text).replace(/\n/g, "<br>");
  }

  extractArtifactsFromMessage(content, rowElement) {
    const codeBlockRegex = /```(html|css|javascript|js|svg|python|jsx|tsx|json|bash)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = (match[1] || "code").toLowerCase();
      const code = match[2].trim();

      if (["html", "svg", "js", "javascript", "css", "jsx", "tsx", "python"].includes(lang) && code.length > 40) {
        const artifactId = "art_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const title = this.inferArtifactTitle(code, lang);

        const artifactObj = {
          id: artifactId,
          title: title,
          language: lang,
          code: code
        };

        this.activeArtifacts.push(artifactObj);

        const artifactCard = document.createElement("div");
        artifactCard.className = "artifact-card-preview";
        artifactCard.innerHTML = `
          <div class="artifact-card-info">
            <div class="artifact-card-icon"><i class="fa-solid fa-cube"></i></div>
            <div>
              <div class="artifact-card-title">${this.escapeHtml(title)}</div>
              <div class="artifact-card-sub">${lang.toUpperCase()} • Click to open interactive artifact</div>
            </div>
          </div>
          <div class="artifact-open-btn">
            <span>Open Artifact</span>
            <i class="fa-solid fa-arrow-right"></i>
          </div>
        `;

        artifactCard.addEventListener("click", () => {
          this.openArtifact(artifactObj);
        });

        const msgBody = rowElement.querySelector(".message-body");
        if (msgBody) msgBody.appendChild(artifactCard);

        if (this.settings.autoOpenArtifacts && !this.dom.artifactsDrawer.classList.contains("open")) {
          this.openArtifact(artifactObj);
        }
      }
    }

    this.updateArtifactsBadge();
  }

  inferArtifactTitle(code, lang) {
    if (lang === "html") {
      const titleMatch = code.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) return titleMatch[1];
      const h1Match = code.match(/<h1>(.*?)<\/h1>/i);
      if (h1Match) return h1Match[1];
      return "Interactive HTML Component";
    }
    if (lang === "svg") return "Vector Graphic (SVG)";
    if (lang === "javascript" || lang === "js") {
      const funcMatch = code.match(/function\s+([a-zA-Z0-9_]+)/);
      if (funcMatch) return `Module: ${funcMatch[1]}()`;
      return "JavaScript Application Logic";
    }
    if (lang === "python") return "Python Script";
    return `${lang.toUpperCase()} Component`;
  }

  updateArtifactsBadge() {
    this.dom.artifactsCounter.textContent = this.activeArtifacts.length;
  }

  openArtifact(artifact) {
    this.currentArtifact = artifact;
    this.dom.artifactTitle.textContent = artifact.title;
    this.dom.artifactSubtitle.textContent = `${artifact.language.toUpperCase()} • ${artifact.code.split("\n").length} lines`;

    this.dom.artifactCodeBlock.textContent = artifact.code;
    this.dom.artifactCodeBlock.className = `language-${artifact.language}`;
    if (typeof hljs !== "undefined") {
      hljs.highlightElement(this.dom.artifactCodeBlock);
    }

    this.renderArtifactPreview(artifact);

    if (["html", "svg"].includes(artifact.language)) {
      this.switchArtifactTab("preview");
    } else {
      this.switchArtifactTab("code");
    }

    this.dom.artifactsDrawer.classList.add("open");
  }

  renderArtifactPreview(artifact) {
    const iframe = this.dom.artifactPreviewIframe;
    let htmlContent = "";

    if (artifact.language === "html") {
      htmlContent = artifact.code;
    } else if (artifact.language === "svg") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#FAF8F5;}</style></head>
        <body>${artifact.code}</body>
        </html>
      `;
    } else if (artifact.language === "javascript" || artifact.language === "js") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>body{font-family:sans-serif;padding:20px;color:#222;background:#FAF8F5;}</style>
        </head>
        <body>
          <h3>Script Output:</h3>
          <pre id="output" style="background:#FFF;padding:12px;border:1px solid #DDD;border-radius:8px;"></pre>
          <script>
            const out = document.getElementById('output');
            const log = console.log;
            console.log = (...args) => {
              out.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a,null,2) : a).join(' ') + '\\n';
              log(...args);
            };
            try {
              ${artifact.code}
            } catch(e) {
              out.textContent += 'Error: ' + e.message;
            }
          <\/script>
        </body>
        </html>
      `;
    } else {
      htmlContent = `<pre style="padding:20px;font-family:monospace;">Preview not available for ${artifact.language}. View Code tab.</pre>`;
    }

    iframe.srcdoc = htmlContent;
  }

  switchArtifactTab(tab) {
    if (tab === "code") {
      this.dom.tabCodeBtn.classList.add("active");
      this.dom.tabPreviewBtn.classList.remove("active");
      this.dom.artifactCodeView.classList.remove("hidden");
      this.dom.artifactPreviewView.classList.add("hidden");
    } else {
      this.dom.tabPreviewBtn.classList.add("active");
      this.dom.tabCodeBtn.classList.remove("active");
      this.dom.artifactPreviewView.classList.remove("hidden");
      this.dom.artifactCodeView.classList.add("hidden");
    }
  }

  toggleArtifactsDrawer() {
    if (this.activeArtifacts.length > 0 && !this.dom.artifactsDrawer.classList.contains("open")) {
      this.openArtifact(this.activeArtifacts[this.activeArtifacts.length - 1]);
    } else {
      this.dom.artifactsDrawer.classList.toggle("open");
    }
  }

  closeArtifactsDrawer() {
    this.dom.artifactsDrawer.classList.remove("open");
  }

  copyArtifactCode() {
    if (!this.currentArtifact) return;
    navigator.clipboard.writeText(this.currentArtifact.code);
    const btn = this.dom.artifactCopyBtn;
    btn.innerHTML = '<i class="fa-solid fa-check text-terracotta"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    }, 2000);
  }

  downloadArtifactCode() {
    if (!this.currentArtifact) return;
    const blob = new Blob([this.currentArtifact.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = this.currentArtifact.language === "javascript" ? "js" : this.currentArtifact.language;
    a.download = `artifact_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // Truly Dynamic Conversational AI Engine
  // ==========================================
  async handleSendMessage() {
    const text = this.dom.chatTextarea.value.trim();
    const attachments = [...this.pendingAttachments];

    if ((!text && attachments.length === 0) || this.isGenerating) return;

    let conv = this.getActiveConversation();
    if (!conv) {
      this.createNewConversation();
      conv = this.getActiveConversation();
    }

    if (conv.messages.length === 0 && text) {
      conv.title = text.slice(0, 32) + (text.length > 32 ? "..." : "");
      this.renderHistory();
    }

    const userMsg = {
      role: "user",
      content: text,
      attachments: attachments,
      timestamp: Date.now()
    };
    conv.messages.push(userMsg);

    this.dom.chatTextarea.value = "";
    this.pendingAttachments = [];
    this.renderAttachmentsPreview();
    this.handleTextareaInput();
    this.renderMessages();

    const assistantMsg = {
      role: "assistant",
      content: "",
      model: MODEL_REGISTRY[this.selectedModelKey].name,
      timestamp: Date.now(),
      fallbackProvider: null
    };
    conv.messages.push(assistantMsg);

    const msgIndex = conv.messages.length - 1;
    this.appendMessageToDOM(assistantMsg, msgIndex);
    this.saveConversations();

    const assistantRow = this.dom.messagesContainer.querySelector(`[data-msg-idx="${msgIndex}"]`);
    const assistantBody = assistantRow.querySelector(".message-body");
    assistantBody.classList.add("streaming-cursor");

    this.isGenerating = true;
    this.dom.sendMessageBtn.disabled = true;

    try {
      await this.routeAndStreamResponse(conv, assistantMsg, assistantBody, assistantRow);
    } catch (err) {
      console.error("AI Generation Error:", err);
      assistantMsg.content += `\n\n*(Notice: ${err.message})*`;
      assistantBody.innerHTML = this.parseMarkdown(assistantMsg.content);
    } finally {
      assistantBody.classList.remove("streaming-cursor");
      this.isGenerating = false;
      this.handleTextareaInput();
      this.saveConversations();
      this.extractArtifactsFromMessage(assistantMsg.content, assistantRow);
    }
  }

  async regenerateResponse(targetIndex) {
    const conv = this.getActiveConversation();
    if (!conv || this.isGenerating) return;

    conv.messages.splice(targetIndex);
    this.renderMessages();

    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const assistantMsg = {
        role: "assistant",
        content: "",
        model: MODEL_REGISTRY[this.selectedModelKey].name,
        timestamp: Date.now(),
        fallbackProvider: null
      };
      conv.messages.push(assistantMsg);
      const msgIndex = conv.messages.length - 1;
      this.appendMessageToDOM(assistantMsg, msgIndex);

      const assistantRow = this.dom.messagesContainer.querySelector(`[data-msg-idx="${msgIndex}"]`);
      const assistantBody = assistantRow.querySelector(".message-body");
      assistantBody.classList.add("streaming-cursor");

      this.isGenerating = true;
      this.dom.sendMessageBtn.disabled = true;

      try {
        await this.routeAndStreamResponse(conv, assistantMsg, assistantBody, assistantRow);
      } catch (err) {
        console.error(err);
      } finally {
        assistantBody.classList.remove("streaming-cursor");
        this.isGenerating = false;
        this.handleTextareaInput();
        this.saveConversations();
      }
    }
  }

  // --- Dynamic Cascade Router ---
  async routeAndStreamResponse(conv, assistantMsg, bodyEl, rowEl) {
    const modelConfig = MODEL_REGISTRY[this.selectedModelKey] || MODEL_REGISTRY["lorn-dts-5.0"];
    const messagesPayload = this.buildMessagesPayload(conv);

    // ROUTE 1: Custom User NVIDIA NIM API (if provided in local settings)
    if (this.settings.nvidiaKey) {
      try {
        console.log("[lornAI] Attempting Local NVIDIA Key...");
        await this.streamFromNVIDIA(this.settings.nvidiaKey, "meta/llama-3.1-70b-instruct", messagesPayload, assistantMsg, bodyEl);
        assistantMsg.fallbackProvider = "NVIDIA NIM (Custom Key)";
        this.updateAssistantMeta(rowEl, assistantMsg);
        return;
      } catch (err) {
        console.warn("[lornAI] NVIDIA NIM Key attempt failed:", err.message);
        this.showFallbackToast("NVIDIA key unavailable, cascading to autonomous model...");
      }
    }

    // ROUTE 2: Custom User Rotating OpenAI Keys (if provided in local settings)
    if (this.settings.keyPool && this.settings.keyPool.length > 0) {
      const poolLen = this.settings.keyPool.length;
      for (let i = 0; i < Math.min(3, poolLen); i++) {
        const key = this.settings.keyPool[this.currentKeyIndex % poolLen];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % poolLen;
        localStorage.setItem("lorn_key_index", this.currentKeyIndex);

        try {
          console.log(`[lornAI] Attempting OpenAI Key #${this.currentKeyIndex}...`);
          await this.streamFromOpenAI(key, "gpt-4o", messagesPayload, assistantMsg, bodyEl);
          assistantMsg.fallbackProvider = `OpenAI Key Pool #${this.currentKeyIndex}`;
          this.updateAssistantMeta(rowEl, assistantMsg);
          return;
        } catch (err) {
          console.warn(`[lornAI] Key #${this.currentKeyIndex} failed:`, err.message);
        }
      }
    }

    // ROUTE 3: Puter.js SDK (if loaded and authenticated)
    if (typeof puter !== "undefined" && puter.ai) {
      try {
        console.log(`[lornAI] Attempting Puter AI: ${modelConfig.puterModel}`);
        const puterSuccess = await this.streamFromPuter(modelConfig.puterModel, messagesPayload, assistantMsg, bodyEl);
        if (puterSuccess) {
          assistantMsg.fallbackProvider = `Puter (${modelConfig.puterModel})`;
          this.updateAssistantMeta(rowEl, assistantMsg);
          return;
        }
      } catch (puterErr) {
        console.warn("[lornAI] Puter SDK failed or unauthenticated:", puterErr.message);
      }
    }

    // ROUTE 4: True Autonomous Free Conversational Engine (No keys required!)
    // Connects directly to high-intelligence conversational streaming endpoints
    console.log(`[lornAI] Engaging Autonomous Conversational Core (${modelConfig.cloudModel})...`);
    await this.streamFromAutonomousCore(modelConfig.cloudModel, messagesPayload, assistantMsg, bodyEl);
    assistantMsg.fallbackProvider = `${modelConfig.name} Core`;
    this.updateAssistantMeta(rowEl, assistantMsg);
  }

  buildMessagesPayload(conv) {
    const messages = [{ role: "system", content: this.settings.systemPrompt }];
    const recent = conv.messages.slice(-10, -1);

    recent.forEach(m => {
      let content = m.content;
      if (m.attachments && m.attachments.length > 0) {
        m.attachments.forEach(att => {
          if (att.type === "text") {
            content += `\n\n[Attached File: ${att.name}]\n${att.data}`;
          }
        });
      }
      messages.push({ role: m.role, content: content });
    });

    return messages;
  }

  // --- Autonomous Free Conversational Core (Streams real human-like conversation) ---
  async streamFromAutonomousCore(modelAlias, messages, assistantMsg, bodyEl) {
    const endpoint = "https://text.pollinations.ai/openai/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelAlias || "openai",
        messages: messages,
        temperature: this.settings.temperature,
        stream: true
      })
    });

    if (!res.ok) {
      throw new Error(`Autonomous service returned HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || "";
            if (delta) {
              assistantMsg.content += delta;
              bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
              this.scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }

    // Safety fallback if no streaming tokens came through
    if (!assistantMsg.content) {
      const fallbackRes = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          model: modelAlias,
          jsonMode: false
        })
      });
      const text = await fallbackRes.text();
      assistantMsg.content = text;
      bodyEl.innerHTML = this.parseMarkdown(text);
    }
  }

  // --- Puter.js Handler ---
  async streamFromPuter(modelName, messages, assistantMsg, bodyEl) {
    const response = await puter.ai.chat(messages, {
      model: modelName,
      stream: true,
      temperature: this.settings.temperature
    });

    let received = false;
    for await (const part of response) {
      const chunk = part?.text || part?.message?.content || "";
      if (chunk) {
        received = true;
        assistantMsg.content += chunk;
        bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
        this.scrollToBottom();
      }
    }

    if (!received && response?.message?.content) {
      const full = typeof response.message.content === "string" 
        ? response.message.content 
        : response.message.content[0]?.text || "";
      if (full) {
        assistantMsg.content = full;
        bodyEl.innerHTML = this.parseMarkdown(full);
        return true;
      }
    }

    return received;
  }

  // --- NVIDIA NIM Handler ---
  async streamFromNVIDIA(apiKey, modelName, messages, assistantMsg, bodyEl) {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: this.settings.temperature,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`NVIDIA HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") break;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || "";
            if (delta) {
              assistantMsg.content += delta;
              bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
              this.scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  }

  // --- OpenAI Compatible Handler ---
  async streamFromOpenAI(apiKey, modelName, messages, assistantMsg, bodyEl) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: this.settings.temperature,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`OpenAI Key HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") break;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || "";
            if (delta) {
              assistantMsg.content += delta;
              bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
              this.scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  }

  showFallbackToast(message) {
    this.dom.fallbackText.textContent = message;
    this.dom.fallbackNotification.classList.remove("hidden");
    setTimeout(() => {
      this.dom.fallbackNotification.classList.add("hidden");
    }, 4000);
  }

  updateAssistantMeta(rowEl, assistantMsg) {
    const metaEl = rowEl.querySelector(".assistant-meta");
    if (metaEl) {
      metaEl.innerHTML = `
        <span class="meta-model-tag">✦ ${assistantMsg.model}</span>
        <span>•</span>
        <span>${this.formatTime(assistantMsg.timestamp)}</span>
        ${assistantMsg.fallbackProvider ? `<span style="color:#D97706;"><i class="fa-solid fa-shield-halved"></i> via ${assistantMsg.fallbackProvider}</span>` : ""}
      `;
    }
  }

  // ==========================================
  // Settings Management (Local Only)
  // ==========================================
  openSettingsModal() {
    this.dom.settingDefaultModel.value = this.settings.defaultModel;
    this.dom.settingTemperature.value = this.settings.temperature;
    this.dom.tempVal.textContent = this.settings.temperature.toFixed(2);
    this.dom.settingAutofailover.checked = this.settings.autoFailover;
    this.dom.settingAutoopenArtifacts.checked = this.settings.autoOpenArtifacts;
    this.dom.nvidiaKeyInput.value = this.settings.nvidiaKey;
    this.dom.keyPoolTextarea.value = this.settings.keyPool.join("\n");
    this.dom.keyPoolCount.textContent = this.settings.keyPool.length;
    this.dom.customSystemPrompt.value = this.settings.systemPrompt;

    this.dom.settingsModal.classList.remove("hidden");
  }

  closeSettingsModal() {
    this.dom.settingsModal.classList.add("hidden");
  }

  saveSettings() {
    this.settings.defaultModel = this.dom.settingDefaultModel.value;
    this.settings.temperature = parseFloat(this.dom.settingTemperature.value);
    this.settings.autoFailover = this.dom.settingAutofailover.checked;
    this.settings.autoOpenArtifacts = this.dom.settingAutoopenArtifacts.checked;
    this.settings.nvidiaKey = this.dom.nvidiaKeyInput.value.trim();

    const keys = this.dom.keyPoolTextarea.value
      .split("\n")
      .map(k => k.trim())
      .filter(k => k.length > 0);
    this.settings.keyPool = keys;
    this.settings.systemPrompt = this.dom.customSystemPrompt.value.trim();

    localStorage.setItem("lorn_setting_model", this.settings.defaultModel);
    localStorage.setItem("lorn_setting_temp", this.settings.temperature.toString());
    localStorage.setItem("lorn_setting_failover", this.settings.autoFailover.toString());
    localStorage.setItem("lorn_setting_auto_artifacts", this.settings.autoOpenArtifacts.toString());
    localStorage.setItem("lorn_nvidia_key", this.settings.nvidiaKey);
    localStorage.setItem("lorn_key_pool", JSON.stringify(this.settings.keyPool));
    localStorage.setItem("lorn_system_prompt", this.settings.systemPrompt);

    this.applySelectedModel(this.settings.defaultModel);
    this.closeSettingsModal();
    alert("Settings safely saved to your browser's private local storage!");
  }

  // ==========================================
  // Helpers
  // ==========================================
  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.lornAI = new LornAIEngine();
});
