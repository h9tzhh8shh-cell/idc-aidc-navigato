<!-- IDC/AIDC adaptation, 2026-10-04: accessible Chinese search and safe keyboard handling. -->
<template>
  <search class="search-bar">
    <form role="search">
      <label for="search" class="search-label" aria-label="搜索来源"></label>
      <input
        id="search"
        ref="search"
        name="search"
        type="search"
        aria-label="搜索来源、机构、指标或关键词"
        placeholder="搜索来源、机构、指标，如 SMM / H100 / 上架率"
        :value="value"
        @input.stop="search($event.target.value)"
        @keydown.enter.exact="open($event)"
        @keydown.alt.enter="open($event, '_blank')"
      />
    </form>
  </search>
</template>

<script>
export default {
  name: "SearchInput",
  props: {
    value: String,
    hotkey: {
      type: String,
      default: "/",
    },
  },
  emits: ["search-open", "search-focus", "search-cancel", "input"],
  mounted() {
    this._keyListener = (event) => {
      if (document.querySelector("dialog[open]")) return;
      const editing =
        /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) ||
        event.target?.isContentEditable;
      if (!editing && !this.hasFocus() && event.key === this.hotkey) {
        event.preventDefault();
        this.focus();
      }
      if (event.key === "Escape" && this.hasFocus()) {
        this.cancel();
      }
    };
    document.addEventListener("keydown", this._keyListener);

    // fill search from get parameter.
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) {
      this.$refs.search.value = search;
      this.search(search);
      this.focus();
    }
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this._keyListener);
  },
  methods: {
    open: function (event, target = null) {
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!this.$refs.search.value) {
        return;
      }
      this.$emit("search-open", target);
    },
    focus: function () {
      this.$emit("search-focus");
      this.$nextTick(() => {
        this.$refs.search.focus();
      });
    },
    hasFocus: function () {
      return document.activeElement == this.$refs.search;
    },
    setSearchURL: function (value) {
      const url = new URL(window.location);
      if (value === "") {
        url.searchParams.delete("search");
      } else {
        url.searchParams.set("search", value);
      }
      window.history.replaceState("search", null, url);
    },
    cancel: function () {
      this.setSearchURL("");
      this.$refs.search.value = "";
      this.$refs.search.blur();
      this.$emit("search-cancel");
    },
    search: function (value) {
      this.setSearchURL(value);
      this.$emit("input", value.toLowerCase());
    },
  },
};
</script>

<style lang="scss" scoped></style>
