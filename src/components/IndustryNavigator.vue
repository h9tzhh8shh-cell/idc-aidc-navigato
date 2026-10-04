<template>
  <div
    id="app"
    class="industry-app theme-default"
    :class="isDark ? 'dark' : 'light'"
  >
    <a class="skip-link" href="#directory">跳至来源目录</a>
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="showSources()"
        ><span class="brand-icon" aria-hidden="true">算</span
        ><span>算力研究导航<small>COMPUTE RESEARCH</small></span></a
      >
      <p class="side-label">研究分类</p>
      <nav aria-label="研究分类">
        <button
          :class="{ active: !filters.category && view === 'sources' }"
          :aria-pressed="!filters.category && view === 'sources'"
          @click="chooseCategory('')"
        >
          <i class="fas fa-border-all" aria-hidden="true"></i>全部来源
          <span>{{ catalog?.sources.length || 0 }}</span>
        </button>
        <button
          v-for="category in catalog?.categories"
          :key="category.id"
          :class="{
            active: filters.category === category.id && view === 'sources',
          }"
          :aria-pressed="filters.category === category.id && view === 'sources'"
          @click="chooseCategory(category.id)"
        >
          <i :class="category.icon" aria-hidden="true"></i>{{ category.name
          }}<span>{{ countCategory(category.id) }}</span>
        </button>
      </nav>
      <div class="side-divider"></div>
      <button
        class="reports-nav"
        :class="{ active: view === 'sea' }"
        :aria-pressed="view === 'sea'"
        @click="view = 'sea'"
      >
        <i class="fas fa-earth-asia" aria-hidden="true"></i>东南亚专题
        <span>{{ seaSourceCount }}</span>
      </button>
      <button
        class="reports-nav"
        :class="{ active: view === 'reports' }"
        :aria-pressed="view === 'reports'"
        @click="view = 'reports'"
      >
        <i class="far fa-file-lines" aria-hidden="true"></i>动态与报告
        <span>{{ catalog?.reports.length || 0 }}</span>
      </button>
      <div class="side-note">
        <span class="side-note-dot"></span>资料由人工整理
        <p>从来源出发，核对口径。<br />让每个研究判断有据可查。</p>
        <span>基于 Homer · 静态资料站</span>
      </div>
    </aside>
    <main id="directory" tabindex="-1" class="workspace">
      <header class="topbar">
        <p>
          研究工作台 <span>/</span>
          {{
            view === "sea"
              ? "东南亚专题"
              : view === "sources"
                ? "来源目录"
                : "动态与报告"
          }}
        </p>
        <DarkMode default-value="light" @updated="isDark = $event" />
      </header>
      <div v-if="error" class="load-error" role="alert">
        <h1>资料暂时无法加载</h1>
        <p>{{ error }}</p>
        <button @click="loadCatalog">重试加载</button>
      </div>
      <div v-else-if="!catalog" class="loading" role="status">
        正在加载研究目录…
      </div>
      <template v-else>
        <section class="hero">
          <div>
            <p class="eyebrow">
              {{
                view === "sea"
                  ? "SOUTHEAST ASIA / PROJECT INTELLIGENCE"
                  : "IDC / AIDC INTELLIGENCE DIRECTORY"
              }}
            </p>
            <h1 v-if="view === 'sea'">
              东南亚 AIDC / IDC<br class="desktop-break" />项目与商机追踪
            </h1>
            <h1 v-else>
              IDC/AIDC 与算力租赁<br class="desktop-break" />数据导航
            </h1>
            <p class="hero-description">
              {{
                view === "sea"
                  ? "追踪项目进展、供电条件与政策变化，回到原文确认每一步。"
                  : "从研究问题出发，找到数据、读懂口径、回到原始来源。"
              }}
            </p>
          </div>
          <div class="hero-stats">
            <div>
              <strong>{{
                view === "sea" ? seaSourceCount : catalog.sources.length
              }}</strong
              ><span>{{
                view === "sea" ? "长期追踪来源" : "核心数据入口"
              }}</span>
            </div>
            <div>
              <strong>{{
                (view === "sea"
                  ? SEA_REGIONS.length
                  : catalog.categories.length
                )
                  .toString()
                  .padStart(2, "0")
              }}</strong
              ><span>{{ view === "sea" ? "覆盖市场" : "研究方向" }}</span>
            </div>
          </div>
        </section>
        <template v-if="view === 'sources'">
          <section class="featured" aria-label="常用入口">
            <span>常用入口</span
            ><a
              v-for="source in featured"
              :key="source.id"
              :href="source.entryUrl"
              target="_blank"
              rel="noopener noreferrer"
              >{{ source.name
              }}<small v-if="source.entryType === '机构首页'"
                >（机构首页）</small
              >
              <span aria-hidden="true">↗</span></a
            >
          </section>
          <section class="filter-panel" aria-label="来源筛选">
            <div class="search-row">
              <SearchInput
                ref="search"
                :value="filters.query"
                @input="filters.query = $event"
                @search-cancel="filters.query = ''"
                @search-open="openFirst"
              /><span class="search-hint"><kbd>/</kbd> 快速搜索</span>
            </div>
            <div class="filter-row">
              <span class="filter-label"
                ><i class="fas fa-sliders" aria-hidden="true"></i>
                来源筛选</span
              ><label
                >地区<select v-model="filters.region">
                  <option value="">全部地区</option>
                  <option v-for="region in regions" :key="region">
                    {{ region }}
                  </option>
                </select></label
              ><label
                >更新频率<select v-model="filters.frequency">
                  <option value="">全部频率</option>
                  <option
                    v-for="(label, value) in frequencyLabels"
                    :key="value"
                    :value="value"
                  >
                    {{ label }}
                  </option>
                </select></label
              ><label
                >获取条件<select v-model="filters.access">
                  <option value="">全部条件</option>
                  <option
                    v-for="(label, value) in accessLabels"
                    :key="value"
                    :value="value"
                  >
                    {{ label }}
                  </option>
                </select></label
              ><button class="reset" @click="resetFilters">清空筛选</button>
            </div>
          </section>
          <div class="result-head">
            <div>
              <h2>
                {{ selectedCategory?.name || "全部来源" }}
                <span class="result-count" aria-live="polite">{{
                  filtered.length
                }}</span>
              </h2>
              <p>
                {{
                  selectedCategory?.question ||
                  "六个研究方向，按主要分类呈现；跨分类来源仅计数一次。"
                }}
              </p>
            </div>
            <span class="manual-label">人工维护 · 按来源属性筛选</span>
          </div>
          <section v-if="!filtered.length" class="empty-state" role="status">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <h3>没有找到匹配的来源</h3>
            <p>试试更短的关键词，或减少地区、频率和获取条件限制。</p>
            <button class="primary-button" @click="resetFilters">
              清空筛选，查看全部来源
            </button>
          </section>
          <div v-else class="columns is-multiline source-grid">
            <ServiceGroup
              v-for="(group, index) in groups"
              :key="group.id"
              :group="group"
              :group-index="index"
              :is-vertical="false"
              columns="3"
            />
          </div>
        </template>
        <SoutheastAsia v-else-if="view === 'sea'" :catalog="catalog" />
        <section v-else class="reports-section" aria-labelledby="reports-title">
          <div class="result-head">
            <div>
              <h2 id="reports-title">
                动态与报告
                <span class="result-count">{{ catalog.reports.length }}</span>
              </h2>
              <p>
                人工维护的有限样本，按已知发布日期倒序；日期未知的列在末尾。
              </p>
            </div>
            <button @click="showSources()">返回来源目录 →</button>
          </div>
          <div class="report-legend">
            <strong>读懂三个时间</strong><span>数据所属期：描述哪个时期</span
            ><span>发布日期：原文何时发布</span
            ><span>成功核查：何时实际确认原文</span>
          </div>
          <div class="report-tools">
            <label
              >核查状态<select v-model="reportStatus">
                <option value="">全部已收录资料</option>
                <option value="verified">仅已核查原文</option>
                <option value="partial">仅部分可核查</option>
                <option value="unreachable">仅暂不可达</option>
                <option value="unverified">仅待核查</option>
              </select></label
            ><span role="status">{{ displayedReports.length }} 篇</span>
          </div>
          <template v-for="(report, index) in displayedReports" :key="report.id"
            ><h3
              v-if="
                !report.publishedAt &&
                (index === 0 || displayedReports[index - 1].publishedAt)
              "
              class="unknown-date-heading"
            >
              发布日期未知
            </h3>
            <ReportEntry
              :report="report"
              :source-name="sourceMap[report.sourceId]?.name"
          /></template>
          <p v-if="!displayedReports.length" class="empty-inline">
            该状态暂未收录资料。
          </p>
        </section>
        <footer class="research-footer">
          <p>
            资料由人工整理 ·
            {{ catalog.maintainedAt }} 维护批次（不等同于成功核查日期）
          </p>
          <p>来源不等于报告，报价不等于成交；请在使用前核对原文与统计口径。</p>
          <a
            href="https://github.com/bastienwirtz/homer/tree/v26.08.3"
            target="_blank"
            rel="noopener noreferrer"
            >Homer v26.08.3 · Apache-2.0</a
          >
        </footer>
      </template>
    </main>
    <SourceDetails ref="details" :reports="selectedReports" />
  </div>
</template>
<script>
import SearchInput from "./SearchInput.vue";
import DarkMode from "./DarkMode.vue";
import ServiceGroup from "./ServiceGroup.vue";
import SourceDetails from "./SourceDetails.vue";
import ReportEntry from "./ReportEntry.vue";
import SoutheastAsia from "./SoutheastAsia.vue";
import {
  filterSources,
  groupSources,
  sortReports,
  validateCatalog,
  frequencyLabels,
  accessLabels,
  SEA_REGIONS,
  filterSeaSources,
} from "../domain/catalog.js";
const defaults = () => ({
  query: "",
  category: "",
  region: "",
  frequency: "",
  access: "",
});
export default {
  name: "IndustryNavigator",
  components: {
    SearchInput,
    DarkMode,
    ServiceGroup,
    SourceDetails,
    ReportEntry,
    SoutheastAsia,
  },
  provide() {
    return { openSource: this.openSource };
  },
  data: () => ({
    catalog: null,
    error: "",
    filters: defaults(),
    isDark: false,
    view: "sources",
    selectedId: null,
    reportStatus: "",
    frequencyLabels,
    accessLabels,
    SEA_REGIONS,
  }),
  computed: {
    seaSourceCount() {
      return filterSeaSources(this.catalog?.sources || []).length;
    },
    filtered() {
      return filterSources(this.catalog?.sources || [], this.filters);
    },
    groups() {
      return groupSources(
        this.filtered,
        this.catalog.categories,
        this.filters.category,
      ).map((g) => ({
        ...g,
        items: g.items.map((source) => ({
          name: source.name,
          type: "IndustrySource",
          source,
        })),
      }));
    },
    featured() {
      return this.catalog.sources.filter((s) => s.featured);
    },
    regions() {
      return [...new Set(this.catalog.sources.flatMap((s) => s.regions))];
    },
    selectedCategory() {
      return this.catalog.categories.find(
        (c) => c.id === this.filters.category,
      );
    },
    sourceMap() {
      return Object.fromEntries(this.catalog.sources.map((s) => [s.id, s]));
    },
    selectedReports() {
      return sortReports(
        (this.catalog?.reports || []).filter(
          (r) => r.sourceId === this.selectedId,
        ),
      );
    },
    displayedReports() {
      return sortReports(
        this.catalog.reports.filter(
          (r) =>
            !this.reportStatus || r.verificationStatus === this.reportStatus,
        ),
      );
    },
  },
  created() {
    this.loadCatalog();
  },
  methods: {
    async loadCatalog() {
      this.error = "";
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}assets/catalog.json`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const errors = validateCatalog(data);
        if (errors.length) throw new Error(errors.slice(0, 3).join("；"));
        this.catalog = data;
        document.title = data.title;
      } catch (error) {
        this.error = `请通过 HTTP 服务打开网站，并检查 assets/catalog.json。${error.message}`;
      }
    },
    countCategory(id) {
      return this.catalog.sources.filter((s) => s.categoryIds.includes(id))
        .length;
    },
    chooseCategory(id) {
      this.filters.category = id;
      this.view = "sources";
    },
    showSources() {
      this.view = "sources";
    },
    resetFilters() {
      this.filters = defaults();
      this.$refs.search?.setSearchURL("");
    },
    openSource(source, trigger) {
      this.selectedId = source.id;
      this.$refs.details.open(source, trigger);
    },
    openFirst() {
      const source = this.filtered[0];
      if (source) this.openSource(source, document.activeElement);
    },
  },
};
</script>
