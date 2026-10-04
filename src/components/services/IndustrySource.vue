<!-- IDC/AIDC adaptation: extends Homer's Generic card slots; no live API calls. -->
<template>
  <div class="source-cell">
    <article class="source-card" :data-source-id="source.id">
      <Generic :item="{ ...item, url: source.entryUrl, target: '_blank' }">
        <template #icon
          ><span class="source-monogram" aria-hidden="true">{{
            monogram
          }}</span></template
        >
        <template #content>
          <p class="source-org">{{ source.organization }}</p>
          <h3>{{ source.name }} <span aria-hidden="true">↗</span></h3>
        </template>
      </Generic>
      <div class="source-body">
        <p class="source-purpose">{{ source.purpose }}</p>
        <div class="source-meta">
          <span>{{ source.regions.join(" / ") }}</span
          ><span>{{ frequencyLabels[source.frequency] }}</span
          ><span>{{ accessLabels[source.access] }}</span
          ><span v-if="source.entryType === '机构首页'">机构首页入口</span>
        </div>
        <p v-if="source.trackingNote" class="source-tracking">
          {{ source.trackingNote }}
        </p>
        <p v-if="source.trackingNote" class="source-check-date">
          成功核查：{{ source.verifiedAt || "暂无成功记录" }}
        </p>
        <div class="source-bottom">
          <span class="verification" :class="source.verificationStatus"
            ><span aria-hidden="true">●</span>
            {{ statusLabels[source.verificationStatus] }}</span
          >
          <button
            type="button"
            :aria-label="`查看${source.name}详情`"
            @click="openSource(source, $event.currentTarget)"
          >
            查看详情 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  </div>
</template>
<script>
import Generic from "./Generic.vue";
import {
  frequencyLabels,
  accessLabels,
  statusLabels,
} from "../../domain/catalog.js";
export default {
  name: "IndustrySource",
  components: { Generic },
  props: { item: Object },
  inject: ["openSource"],
  data: () => ({ frequencyLabels, accessLabels, statusLabels }),
  computed: {
    source() {
      return this.item.source;
    },
    monogram() {
      return this.source.id.split("-")[0].slice(0, 3).toUpperCase();
    },
  },
};
</script>
