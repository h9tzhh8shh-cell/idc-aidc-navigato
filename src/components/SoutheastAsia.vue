<template>
  <section class="sea-topic" aria-label="东南亚商机追踪">
    <div class="sea-tools">
      <div class="sea-tabs" aria-label="专题内容">
        <button
          type="button"
          :class="{ active: tab === 'updates' }"
          :aria-pressed="tab === 'updates'"
          @click="tab = 'updates'"
        >
          最新动态 <span>{{ reports.length }}</span>
        </button>
        <button
          type="button"
          :class="{ active: tab === 'sources' }"
          :aria-pressed="tab === 'sources'"
          @click="tab = 'sources'"
        >
          追踪来源 <span>{{ sources.length }}</span>
        </button>
      </div>
      <label
        >国家 / 地区
        <select v-model="region" aria-label="东南亚国家筛选">
          <option value="">全部六国</option>
          <option v-for="country in SEA_REGIONS" :key="country">
            {{ country }}
          </option>
        </select>
      </label>
    </div>
    <p class="sea-maintenance">
      人工精选 ·
      {{ catalog.maintainedAt }}
      维护批次。外部来源持续发布，本站资料经人工核查后补充。
    </p>
    <template v-if="tab === 'updates'">
      <div class="result-head">
        <div>
          <h2>{{ region || "东南亚六国" }} · 最新动态</h2>
          <p>
            项目与政策动态、定期报告，按已知发布日期倒序；日期未知的列在末尾。
          </p>
        </div>
        <span class="manual-label" role="status"
          >{{ reports.length }} 条资料</span
        >
      </div>
      <div class="report-legend">
        <strong>先看阶段，再看容量</strong
        ><span>意向、规划、建设与投运分别记录</span
        ><span>已核查原文不等于独立证实项目</span>
      </div>
      <template v-for="(report, index) in reports" :key="report.id">
        <h3
          v-if="
            !report.publishedAt &&
            (index === 0 || reports[index - 1].publishedAt)
          "
          class="unknown-date-heading"
        >
          发布日期未知
        </h3>
        <ReportEntry
          :report="report"
          :source-name="sourceMap[report.sourceId]?.name"
        />
      </template>
      <p v-if="!reports.length" class="empty-inline" role="status">
        该国家暂未收录动态，可切换至追踪来源查看持续更新入口。
      </p>
    </template>
    <template v-else>
      <div class="result-head">
        <div>
          <h2>{{ region || "东南亚六国" }} · 追踪来源</h2>
          <p>
            新闻发现线索，官方公告核对进展，定期报告判断供需；建议查看频率与来源发布周期分别标注。
          </p>
        </div>
        <span class="manual-label" role="status"
          >{{ sources.length }} 个来源</span
        >
      </div>
      <SourceList :sources="sources" :selected-id="selectedId" />
      <p v-if="!sources.length" class="empty-inline" role="status">
        该国家暂未收录来源。
      </p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref } from "vue";
import ReportEntry from "./ReportEntry.vue";
import SourceList from "./SourceList.vue";
import {
  SEA_REGIONS,
  filterSeaSources,
  filterSeaReports,
} from "../domain/catalog.js";

const props = defineProps({
  catalog: { type: Object, required: true },
  selectedId: { type: String, default: null },
});
const tab = ref("updates");
const region = ref("");
const sources = computed(() =>
  filterSeaSources(props.catalog.sources, region.value),
);
const reports = computed(() =>
  filterSeaReports(props.catalog.reports, props.catalog.sources, region.value),
);
const sourceMap = computed(() =>
  Object.fromEntries(props.catalog.sources.map((s) => [s.id, s])),
);
</script>
