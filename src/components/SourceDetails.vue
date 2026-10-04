<template>
  <dialog
    ref="dialog"
    class="source-dialog"
    aria-labelledby="detail-title"
    @close="afterClose"
    @click="backdropClose"
  >
    <template v-if="source">
      <header class="dialog-head">
        <div>
          <p class="eyebrow">
            来源详情 · {{ sourceTypeLabels[source.sourceType] }}
          </p>
          <h2 id="detail-title">{{ source.name }}</h2>
          <p>{{ source.organization }}</p>
        </div>
        <button
          ref="closeButton"
          class="close-button"
          type="button"
          aria-label="关闭来源详情"
          @click="close"
        >
          ×
        </button>
      </header>
      <div class="dialog-content">
        <p class="detail-purpose">{{ source.purpose }}</p>
        <div class="detail-actions">
          <a
            class="primary-link"
            :href="source.entryUrl"
            target="_blank"
            rel="noopener noreferrer"
            >打开{{ source.entryType || "持续更新栏目" }} ↗</a
          ><a
            v-if="source.methodologyUrl"
            :href="source.methodologyUrl"
            target="_blank"
            rel="noopener noreferrer"
            >方法说明 ↗</a
          ><a
            v-if="source.subscriptionUrl"
            :href="source.subscriptionUrl"
            target="_blank"
            rel="noopener noreferrer"
            >前往订阅页面 ↗</a
          >
        </div>
        <section>
          <h3>能回答什么问题</h3>
          <ul>
            <li v-for="q in source.questions" :key="q">{{ q }}</li>
          </ul>
        </section>
        <section>
          <h3>指标与检索别名</h3>
          <p>{{ source.metrics.join("、") }}</p>
          <p v-if="source.aliases.length" class="note">
            检索别名：{{ source.aliases.join("、") }}。检索相关不代表口径相同。
          </p>
        </section>
        <dl class="detail-grid">
          <div>
            <dt>覆盖地区</dt>
            <dd>{{ source.regions.join(" / ") }}</dd>
          </div>
          <div>
            <dt>来源更新频率</dt>
            <dd>
              {{ frequencyLabels[source.frequency] }} ·
              {{ source.frequencyNote }}
            </dd>
          </div>
          <div>
            <dt>获取条件</dt>
            <dd>{{ accessLabels[source.access] }} · {{ source.accessNote }}</dd>
          </div>
          <div v-if="source.trackingNote">
            <dt>建议查看频率</dt>
            <dd>{{ source.trackingNote }}</dd>
          </div>
          <div v-if="source.subscriptionNote">
            <dt>订阅与追踪方式</dt>
            <dd>{{ source.subscriptionNote }}</dd>
          </div>
        </dl>
        <section class="caveats">
          <h3>口径与可比性</h3>
          <ul>
            <li v-for="c in source.caveats" :key="c">{{ c }}</li>
          </ul>
        </section>
        <section>
          <h3>来源核查记录</h3>
          <p class="verification" :class="source.verificationStatus">
            {{ statusLabels[source.verificationStatus] }}
          </p>
          <p>{{ source.verificationNote }}</p>
          <dl class="detail-grid">
            <div>
              <dt>最近成功核查日期</dt>
              <dd>{{ source.verifiedAt || "暂无成功记录" }}</dd>
            </div>
            <div>
              <dt>最近尝试核查日期</dt>
              <dd>{{ source.lastCheckAttemptAt || "未知" }}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>
            相关动态、报告与方法说明 <small>{{ reports.length }} 篇</small>
          </h3>
          <p class="note">发布日期、数据所属期和成功核查日期分别记录。</p>
          <ReportEntry
            v-for="report in reports"
            :key="report.id"
            :report="report"
          />
          <p v-if="!reports.length" class="empty-inline">
            暂未收录具体资料，可打开来源栏目继续查看。
          </p>
        </section>
      </div>
    </template>
  </dialog>
</template>
<script setup>
import { ref, nextTick } from "vue";
import ReportEntry from "./ReportEntry.vue";
import {
  frequencyLabels,
  accessLabels,
  statusLabels,
  sourceTypeLabels,
} from "../domain/catalog.js";
defineProps({ reports: { type: Array, default: () => [] } });
const source = ref(null),
  dialog = ref(null),
  closeButton = ref(null);
let trigger = null;
async function open(value, element) {
  source.value = value;
  trigger = element;
  await nextTick();
  dialog.value.showModal();
  document.body.style.overflow = "hidden";
  closeButton.value.focus();
}
function close() {
  dialog.value.close();
}
function afterClose() {
  document.body.style.overflow = "";
  trigger?.focus();
}
function backdropClose(event) {
  if (event.target === dialog.value) {
    const r = dialog.value.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      close();
  }
}
defineExpose({ open });
</script>
