<template>
  <div
    id="app"
    class="industry-app theme-default light"
    :class="{ 'has-details': selectedId }"
  >
    <a class="skip-link" href="#directory">跳至来源目录</a>
    <aside class="sidebar">
      <div class="sidebar-brand">
        <a class="brand" href="#" @click.prevent="chooseCategory('')">
          <span class="brand-icon" aria-hidden="true"
            ><i class="fas fa-layer-group"></i
          ></span>
          <span>算力研究导航<small>IDC / AIDC Navigator</small></span>
        </a>
        <button
          class="navigation-toggle"
          type="button"
          :aria-expanded="navigationOpen"
          aria-controls="research-navigation"
          aria-label="展开或收起研究导航"
          @click="navigationOpen = !navigationOpen"
        >
          <i
            :class="navigationOpen ? 'fas fa-xmark' : 'fas fa-bars'"
            aria-hidden="true"
          ></i>
        </button>
      </div>
      <div
        id="research-navigation"
        class="sidebar-content"
        :class="{ expanded: navigationOpen }"
      >
        <p class="side-label">研究方向</p>
        <nav aria-label="研究分类">
          <button
            :class="{ active: !filters.category && view === 'sources' }"
            :aria-pressed="!filters.category && view === 'sources'"
            @click="chooseCategory('')"
          >
            <i class="fas fa-database" aria-hidden="true"></i>全部来源<span>{{
              catalog?.sources.length || 0
            }}</span>
          </button>
          <button
            v-for="category in catalog?.categories"
            :key="category.id"
            :class="{
              active: filters.category === category.id && view === 'sources',
            }"
            :aria-pressed="
              filters.category === category.id && view === 'sources'
            "
            @click="chooseCategory(category.id)"
          >
            <i :class="category.icon" aria-hidden="true"></i>{{ category.name }}
          </button>
        </nav>
        <div class="side-divider"></div>
        <p class="side-label">专题研究</p>
        <nav aria-label="专题研究">
          <button
            :class="{ active: view === 'sea' }"
            :aria-pressed="view === 'sea'"
            @click="chooseView('sea')"
          >
            <i class="fas fa-earth-asia" aria-hidden="true"></i>东南亚专题
          </button>
          <button
            :class="{ active: view === 'reports' }"
            :aria-pressed="view === 'reports'"
            @click="chooseView('reports')"
          >
            <i class="far fa-file-lines" aria-hidden="true"></i
            >动态与报告<span>{{ catalog?.reports.length || 0 }}</span>
          </button>
        </nav>
        <div class="side-note">
          <i class="far fa-circle-check" aria-hidden="true"></i
          ><span
            >人工整理 · 原始来源
            <p>资料维护批次 {{ catalog?.maintainedAt || "—" }}</p></span
          >
        </div>
      </div>
    </aside>
    <main id="directory" ref="workspace" tabindex="-1" class="workspace">
      <header class="topbar">
        <p>
          研究工作台 <span>/</span><strong>{{ pageTitle }}</strong>
        </p>
        <span class="workspace-label">IDC / AIDC</span>
      </header>
      <div class="workspace-content">
        <div v-if="error" class="load-error" role="alert">
          <h1>资料暂时无法加载</h1>
          <p>{{ error }}</p>
          <button @click="loadCatalog">重试加载</button>
        </div>
        <div v-else-if="!catalog" class="loading" role="status">
          正在加载研究目录…
        </div>
        <template v-else>
          <section class="page-heading">
            <div>
              <h1>{{ pageTitle }}</h1>
              <span class="heading-count">{{
                view === "sources"
                  ? `${catalog.sources.length} 个来源`
                  : view === "sea"
                    ? `${seaSourceCount} 个追踪来源`
                    : `${catalog.reports.length} 条资料`
              }}</span>
            </div>
            <p>
              {{
                view === "sea"
                  ? "追踪东南亚六国的项目进展、供电条件与政策变化。"
                  : view === "reports"
                    ? "回到原文，区分发布日期、数据所属期与核查日期。"
                    : "从研究问题出发，找到可用的信息来源。"
              }}
            </p>
          </section>
          <template v-if="view === 'sources'">
            <section class="filter-panel" aria-label="来源筛选">
              <div class="search-row">
                <SearchInput
                  ref="search"
                  :value="filters.query"
                  @input="filters.query = $event"
                  @search-cancel="filters.query = ''"
                  @search-open="openFirst"
                /><span class="search-hint" aria-hidden="true"
                  ><kbd>/</kbd></span
                >
              </div>
              <div class="filter-row">
                <label
                  ><span class="sr-only">地区</span
                  ><select v-model="filters.region" aria-label="地区">
                    <option value="">全部地区</option>
                    <option v-for="region in regions" :key="region">
                      {{ region }}
                    </option>
                  </select></label
                >
                <label
                  ><span class="sr-only">更新频率</span
                  ><select v-model="filters.frequency" aria-label="更新频率">
                    <option value="">更新频率</option>
                    <option
                      v-for="(label, value) in frequencyLabels"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </select></label
                >
                <label
                  ><span class="sr-only">获取条件</span
                  ><select v-model="filters.access" aria-label="获取条件">
                    <option value="">获取条件</option>
                    <option
                      v-for="(label, value) in accessLabels"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </select></label
                >
                <button class="reset" @click="resetFilters">重置</button>
              </div>
            </section>
            <div class="result-head">
              <div>
                <h2>
                  {{ selectedCategory?.name || "全部来源"
                  }}<span class="result-count" aria-live="polite">{{
                    filtered.length
                  }}</span>
                </h2>
                <p v-if="selectedCategory">{{ selectedCategory.question }}</p>
              </div>
              <span class="manual-label">选择来源查看详情</span>
            </div>
            <section v-if="!filtered.length" class="empty-state" role="status">
              <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
              <h3>没有找到匹配的来源</h3>
              <p>试试更短的关键词，或减少地区、频率和获取条件限制。</p>
              <button class="primary-button" @click="resetFilters">
                清空筛选，查看全部来源
              </button>
            </section>
            <SourceList v-else :sources="filtered" :selected-id="selectedId" />
            <p class="list-summary" role="status">
              显示 {{ filtered.length }} 个来源，共
              {{ catalog.sources.length }} 个
            </p>
          </template>
          <SoutheastAsia
            v-else-if="view === 'sea'"
            :catalog="catalog"
            :selected-id="selectedId"
          />
          <section v-else class="reports-section" aria-label="动态与报告">
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
              ><span role="status"
                >{{ displayedReports.length }} 篇 · 按发布日期倒序</span
              >
            </div>
            <template
              v-for="(report, index) in displayedReports"
              :key="report.id"
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
              人工整理 ·
              {{ catalog.maintainedAt }} 维护批次，来源核查日期请查看详情。
            </p>
            <p>
              报价与成交、规划与投运分别核对。<a
                href="https://github.com/bastienwirtz/homer/tree/v26.08.3"
                target="_blank"
                rel="noopener noreferrer"
                >基于 Homer · Apache-2.0 ↗</a
              >
            </p>
          </footer>
        </template>
      </div>
    </main>
    <SourceDetails
      ref="details"
      :reports="selectedReports"
      @closed="detailsClosed"
    />
  </div>
</template>
<script>
import SearchInput from "./SearchInput.vue";
import SourceList from "./SourceList.vue";
import SourceDetails from "./SourceDetails.vue";
import ReportEntry from "./ReportEntry.vue";
import SoutheastAsia from "./SoutheastAsia.vue";
import {
  filterSources,
  sortReports,
  validateCatalog,
  frequencyLabels,
  accessLabels,
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
    SourceList,
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
    view: "sources",
    selectedId: null,
    reportStatus: "",
    navigationOpen: false,
    frequencyLabels,
    accessLabels,
  }),
  computed: {
    pageTitle() {
      return this.view === "sea"
        ? "东南亚专题"
        : this.view === "reports"
          ? "动态与报告"
          : "来源目录";
    },
    seaSourceCount() {
      return filterSeaSources(this.catalog?.sources || []).length;
    },
    filtered() {
      return filterSources(this.catalog?.sources || [], this.filters);
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
    chooseCategory(id) {
      this.filters.category = id;
      this.chooseView("sources");
    },
    chooseView(view) {
      this.$refs.details.close();
      this.view = view;
      this.navigationOpen = false;
      this.$nextTick(() => {
        this.$refs.workspace.scrollTop = 0;
      });
    },
    resetFilters() {
      this.filters = defaults();
      this.$refs.search?.setSearchURL("");
    },
    openSource(source, trigger) {
      const scrollTop = this.$refs.workspace.scrollTop;
      this.selectedId = source.id;
      this.$refs.details.open(source, trigger);
      this.$nextTick(() => {
        this.$refs.workspace.scrollTop = scrollTop;
      });
    },
    detailsClosed() {
      const scrollTop = this.$refs.workspace.scrollTop;
      this.selectedId = null;
      this.$nextTick(() => {
        this.$refs.workspace.scrollTop = scrollTop;
      });
    },
    openFirst() {
      const source = this.filtered[0];
      if (source) this.openSource(source, document.activeElement);
    },
  },
};
</script>
