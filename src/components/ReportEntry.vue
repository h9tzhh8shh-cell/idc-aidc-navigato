<template>
  <article class="report-entry" :data-report-id="report.id">
    <div class="report-top">
      <span class="eyebrow">{{ kindLabels[report.kind] }}</span
      ><span class="verification" :class="report.verificationStatus">{{
        statusLabels[report.verificationStatus]
      }}</span>
    </div>
    <h3>
      <a :href="report.url" target="_blank" rel="noopener noreferrer"
        >{{ report.title }} <span aria-hidden="true">↗</span></a
      >
    </h3>
    <p v-if="sourceName" class="report-source">来源：{{ sourceName }}</p>
    <p>{{ report.summary }}</p>
    <dl class="report-dates">
      <div>
        <dt>发布日期</dt>
        <dd>{{ report.publishedAt || "未知 / 待核查" }}</dd>
      </div>
      <div>
        <dt>数据所属期</dt>
        <dd>{{ report.dataPeriod || "未知 / 不适用" }}</dd>
      </div>
      <div>
        <dt>最近成功核查</dt>
        <dd>{{ report.verifiedAt || "暂无成功记录" }}</dd>
      </div>
    </dl>
    <p v-if="report.verificationNote" class="note">
      {{ report.verificationNote }}
    </p>
  </article>
</template>
<script setup>
import { kindLabels, statusLabels } from "../domain/catalog.js";
defineProps({ report: { type: Object, required: true }, sourceName: String });
</script>
