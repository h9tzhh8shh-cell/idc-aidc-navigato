<!-- IDC/AIDC adaptation, 2026-10-04: keyboard-operable button and Chinese labels. -->
<template>
  <button
    type="button"
    :aria-label="`切换主题，当前${titles?.[mode] || '浅色'}`"
    class="navbar-item is-inline-block-mobile"
    @click="toggleTheme()"
  >
    <i
      :class="`${faClasses[mode]}`"
      class="fa-fw"
      :title="`${titles[mode]}`"
    ></i>
  </button>
</template>

<script>
export default {
  name: "Darkmode",
  props: {
    defaultValue: String,
  },
  emits: ["updated"],
  data: function () {
    return {
      isDark: null,
      faClasses: null,
      titles: null,
      mode: null,
    };
  },
  created: function () {
    this.faClasses = ["fas fa-adjust", "fas fa-circle", "far fa-circle"];
    this.titles = ["跟随系统", "浅色", "深色"];
    this.mode = 0;
    if ("overrideDark" in localStorage) {
      // Light theme is 1 and Dark theme is 2
      this.mode = JSON.parse(localStorage.overrideDark) ? 2 : 1;
    } else {
      switch (this.defaultValue) {
        case "light":
          this.mode = 1;
          break;
        case "dark":
          this.mode = 2;
          break;
        default:
          this.mode = 0;
      }
    }
    this.isDark = this.getIsDark();
    this.$emit("updated", this.isDark);
    this.watchIsDark();
  },
  methods: {
    toggleTheme: function () {
      this.mode = (this.mode + 1) % 3;
      switch (this.mode) {
        // Default behavior
        case 0:
          localStorage.removeItem("overrideDark");
          break;
        // Force light theme
        case 1:
          localStorage.overrideDark = false;
          break;
        // Force dark theme
        case 2:
          localStorage.overrideDark = true;
          break;
        default:
          // Should be unreachable
          break;
      }

      this.isDark = this.getIsDark();
      this.$emit("updated", this.isDark);
    },

    getIsDark: function () {
      const values = [
        matchMedia("(prefers-color-scheme: dark)").matches,
        false,
        true,
      ];
      return values[this.mode];
    },

    watchIsDark: function () {
      matchMedia("(prefers-color-scheme: dark)").addEventListener(
        "change",
        () => {
          this.isDark = this.getIsDark();
          this.$emit("updated", this.isDark);
        },
      );
    },
  },
};
</script>
