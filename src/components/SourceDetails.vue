<template>
  <component
    :is="isDrawer ? 'dialog' : 'aside'"
    v-if="source"
    ref="panel"
    class="source-details"
    :class="{ 'is-drawer': isDrawer }"
    aria-labelledby="detail-title"
    @cancel.prevent="close"
    @close="close"
    @keydown.esc.stop.prevent="close"
    @click="backdropClose"
  >
    <header class="detail-toolbar">
      <span>来源详情</span>
      <button
        ref="closeButton"
        class="detail-close"
        type="button"
        aria-label="关闭来源详情"
        @click="close"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </header>
    <div class="detail-content">
      <div class="detail-identity">
        <span class="detail-monogram" aria-hidden="true">{{
          source.name.slice(0, 1).toUpperCase()
        }}</span>
        <div>
          <h2 id="detail-title">{{ source.name }}</h2>
          <p class="detail-domain">{{ domain }}</p>
          <span class="detail-type">{{
            sourceTypeLabels[source.sourceType]
          }}</span>
        </div>
      </div>
      <div class="detail-actions">
        <a
          class="detail-visit"
          :href="source.entryUrl"
          target="_blank"
          rel="noopener noreferrer"
          >访问原站 <span aria-hidden="true">↗</span></a
        >
        <div
          v-if="source.methodologyUrl || source.subscriptionUrl"
          class="detail-secondary-links"
        >
          <a
            v-if="source.methodologyUrl"
            :href="source.methodologyUrl"
            target="_blank"
            rel="noopener noreferrer"
            >方法说明 ↗</a
          >
          <a
            v-if="source.subscriptionUrl"
            :href="source.subscriptionUrl"
            target="_blank"
            rel="noopener noreferrer"
            >前往订阅页面 ↗</a
          >
        </div>
      </div>
      <section class="detail-section">
        <h3>来源概览</h3>
        <dl class="detail-facts">
          <div>
            <dt>覆盖地区</dt>
            <dd>{{ source.regions.join(" / ") }}</dd>
          </div>
          <div>
            <dt>来源更新频率</dt>
            <dd>{{ frequencyLabels[source.frequency] }}</dd>
          </div>
          <div>
            <dt>获取条件</dt>
            <dd>{{ accessLabels[source.access] }}</dd>
          </div>
        </dl>
      </section>
      <section class="detail-section">
        <h3>适合研究什么</h3>
        <ul>
          <li v-for="question in source.questions" :key="question">
            {{ question }}
          </li>
        </ul>
      </section>
      <section class="detail-caveats">
        <h3><span aria-hidden="true">!</span> 口径与使用提示</h3>
        <ul>
          <li v-for="caveat in source.caveats" :key="caveat">{{ caveat }}</li>
        </ul>
      </section>
      <section class="detail-section detail-verification">
        <div class="detail-section-heading">
          <h3>来源核查记录</h3>
          <span class="verification" :class="source.verificationStatus">{{
            statusLabels[source.verificationStatus]
          }}</span>
        </div>
        <p>{{ source.verificationNote }}</p>
        <dl class="detail-facts">
          <div>
            <dt>最近成功核查</dt>
            <dd>{{ source.verifiedAt || "暂无成功记录" }}</dd>
          </div>
          <div>
            <dt>最近尝试核查</dt>
            <dd>{{ source.lastCheckAttemptAt || "未知" }}</dd>
          </div>
        </dl>
      </section>
      <section class="detail-section">
        <h3>完整来源说明</h3>
        <p>{{ source.purpose }}</p>
        <dl class="detail-notes">
          <div>
            <dt>发布机构</dt>
            <dd>{{ source.organization }}</dd>
          </div>
          <div>
            <dt>更新频率说明</dt>
            <dd>{{ source.frequencyNote }}</dd>
          </div>
          <div>
            <dt>获取条件说明</dt>
            <dd>{{ source.accessNote }}</dd>
          </div>
          <div v-if="source.trackingNote">
            <dt>建议查看频率</dt>
            <dd>{{ source.trackingNote }}</dd>
          </div>
          <div v-if="source.subscriptionNote">
            <dt>订阅与追踪方式</dt>
            <dd>{{ source.subscriptionNote }}</dd>
          </div>
          <div>
            <dt>指标</dt>
            <dd>{{ source.metrics.join("、") }}</dd>
          </div>
          <div v-if="source.aliases.length">
            <dt>检索别名</dt>
            <dd>{{ source.aliases.join("、") }}。检索相关不代表口径相同。</dd>
          </div>
        </dl>
      </section>
      <section class="detail-section detail-reports">
        <h3>
          相关动态与报告 <small>{{ reports.length }} 篇</small>
        </h3>
        <p class="detail-muted">发布日期、数据所属期与成功核查日期分别记录。</p>
        <ReportEntry
          v-for="report in reports"
          :key="report.id"
          :report="report"
        />
        <p v-if="!reports.length" class="detail-muted">
          暂未收录具体资料，可访问原站继续查看。
        </p>
      </section>
    </div>
  </component>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import ReportEntry from "./ReportEntry.vue";
import {
  frequencyLabels,
  accessLabels,
  statusLabels,
  sourceTypeLabels,
} from "../domain/catalog.js";

defineProps({ reports: { type: Array, default: () => [] } });
const emit = defineEmits(["closed"]);
const desktopQuery = window.matchMedia("(min-width: 1200px)");
const isDrawer = ref(!desktopQuery.matches);
const source = ref(null);
const panel = ref(null);
const closeButton = ref(null);
const domain = computed(() =>
  source.value ? new URL(source.value.entryUrl).hostname : "",
);
let trigger = null;
let savedBodyOverflow = "";
let bodyLocked = false;

function lockBody(locked) {
  if (locked && !bodyLocked) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    bodyLocked = true;
  } else if (!locked && bodyLocked) {
    document.body.style.overflow = savedBodyOverflow;
    bodyLocked = false;
  }
}

async function showPanel() {
  await nextTick();
  if (!source.value || !panel.value) return;
  if (isDrawer.value && !panel.value.open) panel.value.showModal();
  lockBody(isDrawer.value);
  closeButton.value?.focus({ preventScroll: true });
}

async function open(value, element) {
  source.value = value;
  trigger = element;
  await showPanel();
  if (panel.value) panel.value.scrollTop = 0;
}

async function close() {
  if (!source.value) return;
  const returnFocus = trigger;
  source.value = null;
  lockBody(false);
  emit("closed");
  await nextTick();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

async function updateLayout() {
  isDrawer.value = !desktopQuery.matches;
  lockBody(false);
  if (source.value) await showPanel();
}

function backdropClose(event) {
  if (!isDrawer.value || event.target !== panel.value) return;
  const bounds = panel.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    close();
}

onMounted(() => desktopQuery.addEventListener("change", updateLayout));
onBeforeUnmount(() => {
  desktopQuery.removeEventListener("change", updateLayout);
  lockBody(false);
});
defineExpose({ open, close });
</script>

<style scoped>
.source-details {
  position: sticky;
  top: 0;
  align-self: start;
  min-width: 0;
  width: 100%;
  height: 100dvh;
  margin: 0;
  padding: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 0;
  border-left: 1px solid #e4e8ef;
  background: #fff;
  color: #26344d;
  font-size: 14px;
  line-height: 1.7;
  text-align: left;
}
.source-details.is-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(430px, 100vw);
  max-width: 100vw;
  max-height: none;
  margin: 0;
  box-shadow: -8px 0 40px #142c4920;
}
.source-details::backdrop {
  background: #152b4c66;
}
.detail-toolbar {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: 12px 22px;
  border-bottom: 1px solid #edf0f5;
  background: #fff;
  color: #17253f;
  font-weight: 650;
}
.detail-close {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 6px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #61718d;
  cursor: pointer;
}
.detail-close:hover {
  background: #f0f4fa;
  color: #1a63df;
}
.detail-close svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.source-details :is(a, button):focus-visible {
  outline: 2px solid #1768ec;
  outline-offset: 3px;
}
.detail-content {
  padding: 26px 22px 36px;
}
.detail-identity {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.detail-identity > div {
  min-width: 0;
}
.detail-monogram {
  display: grid;
  flex: 0 0 50px;
  height: 50px;
  place-items: center;
  border-radius: 9px;
  background: #1768ee;
  color: #fff;
  font-size: 25px;
  font-weight: 650;
}
.source-details h2 {
  margin: 0;
  color: #16233b;
  font-size: 19px;
  line-height: 1.45;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.source-details p {
  margin: 0 0 12px;
}
.source-details .detail-domain {
  margin: 2px 0 8px;
  color: #66758d;
  overflow-wrap: anywhere;
}
.detail-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0f3f7;
  color: #536077;
  font-size: 12px;
  font-weight: 550;
}
.detail-actions {
  margin: 24px 0 28px;
}
.source-details .detail-visit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border-radius: 5px;
  background: #1466ed;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
.source-details .detail-visit:hover {
  background: #1057ce;
  color: #fff;
}
.detail-secondary-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 12px;
}
.detail-secondary-links a {
  color: #235fbb;
  text-underline-offset: 3px;
}
.detail-section {
  margin-top: 26px;
}
.source-details h3 {
  margin: 0 0 12px;
  color: #1e2c45;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.6;
}
.source-details h3 small {
  margin-left: 5px;
  color: #68768c;
  font-size: 13px;
  font-weight: 400;
}
.source-details ul {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}
.source-details li + li {
  margin-top: 8px;
}
.detail-facts {
  margin: 0;
  border-top: 1px solid #e9edf3;
}
.detail-facts > div {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e9edf3;
}
.source-details dt {
  color: #67768c;
  font-weight: 400;
}
.source-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-caveats {
  margin-top: 24px;
  padding: 14px;
  border: 1px solid #f1dfb2;
  border-radius: 6px;
  background: #fffbf1;
}
.detail-caveats h3 {
  color: #976318;
}
.detail-caveats h3 span {
  display: inline-grid;
  width: 17px;
  height: 17px;
  margin-right: 4px;
  place-items: center;
  border-radius: 50%;
  background: #ed962b;
  color: #fff;
  font-size: 12px;
  line-height: 1;
}
.detail-section-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.detail-section-heading h3 {
  margin: 0;
}
.detail-notes {
  margin: 0;
}
.detail-notes > div {
  margin-top: 14px;
}
.detail-notes dt {
  margin-bottom: 3px;
}
.source-details .detail-muted {
  color: #68768c;
}
.detail-reports :deep(.report-entry) {
  margin-top: 14px;
  padding: 14px;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.detail-reports :deep(.report-entry h3) {
  font-size: 15px;
}
.detail-reports :deep(.report-dates) {
  grid-template-columns: 1fr;
}
@media (max-width: 420px) {
  .detail-toolbar {
    padding-inline: 18px;
  }
  .detail-content {
    padding-inline: 18px;
  }
}
</style>
