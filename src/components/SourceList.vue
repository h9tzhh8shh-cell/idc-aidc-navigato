<template>
  <div class="source-list">
    <div class="source-list-head" aria-hidden="true">
      <span>来源 / 主要用途</span><span>地区</span><span>更新频率</span
      ><span>获取条件</span>
    </div>
    <ul aria-label="来源列表">
      <li v-for="source in sources" :key="source.id">
        <button
          type="button"
          class="source-row"
          :class="{ selected: selectedId === source.id }"
          :data-source-id="source.id"
          :aria-pressed="selectedId === source.id"
          :aria-label="`查看${source.name}详情`"
          :aria-describedby="`${source.id}-purpose ${source.id}-region ${source.id}-frequency ${source.id}-access`"
          @click="openSource(source, $event.currentTarget)"
        >
          <span class="source-identity">
            <span class="source-letter" aria-hidden="true">{{
              source.name.slice(0, 1).toUpperCase()
            }}</span>
            <span class="source-copy"
              ><strong>{{ source.name }}</strong
              ><span :id="`${source.id}-purpose`">{{
                source.purpose
              }}</span></span
            >
          </span>
          <span :id="`${source.id}-region`" class="source-region"
            ><span class="mobile-meta-label">地区</span
            >{{ source.regions.join(" / ") }}</span
          >
          <span :id="`${source.id}-frequency`" class="source-frequency"
            ><span class="mobile-meta-label">更新频率</span
            ><span class="attribute-tag">{{
              frequencyLabels[source.frequency]
            }}</span></span
          >
          <span :id="`${source.id}-access`" class="source-access"
            ><span class="mobile-meta-label">获取条件</span
            ><span
              class="attribute-tag"
              :class="{ 'access-free': source.access === 'free' }"
              >{{ accessLabels[source.access] }}</span
            ></span
          >
        </button>
      </li>
    </ul>
  </div>
</template>
<script setup>
import { inject } from "vue";
import { frequencyLabels, accessLabels } from "../domain/catalog.js";
defineProps({
  sources: { type: Array, required: true },
  selectedId: { type: String, default: null },
});
const openSource = inject("openSource");
</script>
