import { Fragment, useMemo, useState } from "react";

const REQUIRED_COLUMNS = ["Date", "Category", "Note", "Income/Expense", "Amount", "Month"];

export default function App() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [openSectionsByView, setOpenSectionsByView] = useState({
    all: { summary: true, expenseSplit: true, details: true },
    course: { summary: true, expenseSplit: false, details: true },
  });
  const [openMonthsByView, setOpenMonthsByView] = useState({
    all: {},
    course: {},
  });
  const [openExpenseSplitMonths, setOpenExpenseSplitMonths] = useState({});

  const allMonths = useMemo(() => buildMonthlyGroups(rows), [rows]);
  const allExpenseSplitMonths = useMemo(() => buildExpenseSplitMonths(rows), [rows]);
  const courseRows = useMemo(() => filterCourseRows(rows), [rows]);
  const courseMonths = useMemo(() => buildMonthlyGroups(courseRows), [courseRows]);
  const coursePerformance = useMemo(() => buildCoursePerformance(courseRows), [courseRows]);

  async function handleFileChange(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    setError("");
    setFileName(file.name);

    try {
      const rawText = await file.text();
      const parsedRows = parseRows(rawText);
      setRows(parsedRows);
      setOpenSectionsByView({
        all: { summary: true, expenseSplit: true, details: true },
        course: { summary: true, expenseSplit: false, details: true },
      });
      setOpenMonthsByView({ all: {}, course: {} });
      setOpenExpenseSplitMonths({});
    } catch (parseError) {
      setRows([]);
      setOpenSectionsByView({
        all: { summary: true, expenseSplit: true, details: true },
        course: { summary: true, expenseSplit: false, details: true },
      });
      setOpenMonthsByView({ all: {}, course: {} });
      setOpenExpenseSplitMonths({});
      setError(parseError instanceof Error ? parseError.message : "Could not parse the file.");
    }
  }

  function toggleMonth(viewKey, month) {
    setOpenMonthsByView((current) => ({
      ...current,
      [viewKey]: {
        ...current[viewKey],
        [month]: !current[viewKey]?.[month],
      },
    }));
  }

  function toggleSection(viewKey, sectionKey) {
    setOpenSectionsByView((current) => ({
      ...current,
      [viewKey]: {
        ...current[viewKey],
        [sectionKey]: !current[viewKey]?.[sectionKey],
      },
    }));
  }

  function toggleExpenseSplitMonth(month) {
    setOpenExpenseSplitMonths((current) => ({
      ...current,
      [month]: !current[month],
    }));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Money View</p>
          <h1>React dashboard for monthly income, expenses, and note-wise category totals.</h1>
          <p className="subcopy">
            Upload your CSV or TSV export. The app cleans duplicate header rows, groups everything by
            month, and builds category totals from the <strong>Note</strong> column.
          </p>
        </div>
        <div className="hero-accent" aria-hidden="true">
          <div className="accent-ring accent-ring-large" />
          <div className="accent-ring accent-ring-small" />
        </div>
      </section>

      <section className="panel uploader-panel">
        <label className="upload-box" htmlFor="fileInput">
          <input
            id="fileInput"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={handleFileChange}
          />
          <span className="upload-title">Choose transaction file</span>
          <span className="upload-hint">Supports your export format automatically</span>
        </label>

        <div className="status-row">
          <p className="status-message">
            {error
              ? error
              : fileName
                ? `Loaded ${rows.length} transactions from ${fileName}.`
                : "No file loaded yet."}
          </p>
          <p className="status-note">CSV and tab-separated files both work.</p>
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <section className="panel tabs-panel">
            <div className="tab-list" role="tablist" aria-label="Report views">
              <button
                type="button"
                className={`tab-button ${activeView === "all" ? "tab-button-active" : ""}`}
                onClick={() => setActiveView("all")}
                role="tab"
                aria-selected={activeView === "all"}
              >
                Full view
              </button>
              <button
                type="button"
                className={`tab-button ${activeView === "course" ? "tab-button-active" : ""}`}
                onClick={() => setActiveView("course")}
                role="tab"
                aria-selected={activeView === "course"}
              >
                Course excel only
              </button>
            </div>
          </section>

          {activeView === "all" ? (
            <ReportView
              months={allMonths}
              expenseSplitMonths={allExpenseSplitMonths}
              coursePerformance={null}
              openSections={openSectionsByView.all}
              openMonths={openMonthsByView.all}
              openExpenseSplitMonths={openExpenseSplitMonths}
              onToggleSection={(sectionKey) => toggleSection("all", sectionKey)}
              onToggleMonth={(month) => toggleMonth("all", month)}
              onToggleExpenseSplitMonth={toggleExpenseSplitMonth}
              splitIncomeTransactions={false}
              showCourseExpenseSplit={false}
              showOverallExpenseSplitSection
            />
          ) : (
            <ReportView
              months={courseMonths}
              expenseSplitMonths={[]}
              coursePerformance={coursePerformance}
              openSections={openSectionsByView.course}
              openMonths={openMonthsByView.course}
              openExpenseSplitMonths={{}}
              onToggleSection={(sectionKey) => toggleSection("course", sectionKey)}
              onToggleMonth={(month) => toggleMonth("course", month)}
              onToggleExpenseSplitMonth={() => {}}
              splitIncomeTransactions
              showCourseExpenseSplit
              showOverallExpenseSplitSection={false}
            />
          )}
        </>
      )}
    </main>
  );
}

function ReportView({
  months,
  expenseSplitMonths,
  coursePerformance,
  openSections,
  openMonths,
  openExpenseSplitMonths,
  onToggleSection,
  onToggleMonth,
  onToggleExpenseSplitMonth,
  splitIncomeTransactions,
  showCourseExpenseSplit,
  showOverallExpenseSplitSection,
}) {
  const [openFixedCostMonths, setOpenFixedCostMonths] = useState({});

  if (!months.length) {
    return (
      <section className="panel empty-panel">
        <p className="status-message">No matching transactions found for this view.</p>
      </section>
    );
  }

  return (
    <>
      {coursePerformance && (
        <section className="panel course-performance-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Course Excel</p>
              <h2>Performance snapshot</h2>
            </div>
          </div>

          <div className="course-metric-grid">
            <div className="course-metric">
              <span>Total expenses</span>
              <strong className="amount-expense">{formatCurrency(coursePerformance.totalExpenses)}</strong>
            </div>
            <div className="course-metric">
              <span>Total income</span>
              <strong className="amount-income">{formatCurrency(coursePerformance.totalIncome)}</strong>
            </div>
            <div className="course-metric">
              <span>Remaining expenses</span>
              <strong className={coursePerformance.remainingExpenses >= 0 ? "amount-expense" : "amount-income"}>
                {formatCurrency(coursePerformance.remainingExpenses)}
              </strong>
            </div>
            <div className="course-metric">
              <span>Expense % of income</span>
              <strong>{formatPercentage(coursePerformance.expensePercentage)}</strong>
            </div>
          </div>

          <div className="course-chart">
            {coursePerformance.chartBars.map((bar) => (
              <div className="course-chart-item" key={bar.label}>
                <div className="course-chart-bar-wrap">
                  <div
                    className={`course-chart-bar ${bar.className}`}
                    style={{ height: `${bar.heightPercent}%` }}
                  />
                </div>
                <strong className={bar.className}>{formatCurrency(bar.value)}</strong>
                <span>{bar.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel summary-panel">
        <button
          type="button"
          className="section-heading section-toggle"
          onClick={() => onToggleSection("summary")}
          aria-expanded={Boolean(openSections.summary)}
        >
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Monthly summary</h2>
          </div>
          <span className="month-toggle-indicator">{openSections.summary ? "Hide" : "Show"}</span>
        </button>

        {openSections.summary && (
          <div className="table-wrap">
            <table className="data-table summary-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Expense</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month}>
                    <td className="month-cell">{month.month}</td>
                    <td className="amount-income">{formatCurrency(month.income)}</td>
                    <td className="amount-expense">{formatCurrency(month.expense)}</td>
                    <td className={month.net >= 0 ? "amount-income" : "amount-expense"}>
                      {formatCurrency(month.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showOverallExpenseSplitSection && (
        <section className="panel summary-panel">
          <button
            type="button"
            className="section-heading section-toggle"
            onClick={() => onToggleSection("expenseSplit")}
            aria-expanded={Boolean(openSections.expenseSplit)}
          >
            <div>
              <p className="eyebrow">Expenses</p>
              <h2>Expense split</h2>
            </div>
            <span className="month-toggle-indicator">{openSections.expenseSplit ? "Hide" : "Show"}</span>
          </button>

          {openSections.expenseSplit && (
            <div className="table-wrap">
              <table className="data-table summary-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Course Excel</th>
                    <th>Regular monthly expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSplitMonths.map((month) => (
                    <Fragment key={`${month.month}-expense-split-group`}>
                      <tr
                        key={`${month.month}-expense-split`}
                        className="clickable-row"
                        onClick={() => onToggleExpenseSplitMonth(month.month)}
                        aria-expanded={Boolean(openExpenseSplitMonths[month.month])}
                      >
                        <td className="month-cell">{month.month}</td>
                        <td className="amount-expense">{formatCurrency(month.courseExcelExpense)}</td>
                        <td className="amount-expense">{formatCurrency(month.regularExpense)}</td>
                      </tr>
                      {openExpenseSplitMonths[month.month] && (
                        <tr key={`${month.month}-expense-split-details`}>
                          <td colSpan="3" className="expanded-cell">
                            <div className="breakdown-stack expense-split-detail-grid">
                              <div className="table-wrap">
                                <div className="breakdown-header">
                                  <span>Course Excel</span>
                                </div>
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Note Category</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {month.courseExcelRows.map((entry) => (
                                      <tr key={`${month.month}-course-expense-${entry.note}`}>
                                        <td>{entry.note}</td>
                                        <td className="amount-expense">{formatCurrency(entry.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="table-wrap">
                                <div className="breakdown-header">
                                  <span>Regular monthly expenses</span>
                                </div>
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Note Category</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {month.regularExpenseRows.map((entry) => (
                                      <tr key={`${month.month}-regular-expense-${entry.note}`}>
                                        <td>{entry.note}</td>
                                        <td className="amount-expense">{formatCurrency(entry.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel details-panel">
        <button
          type="button"
          className="section-heading section-toggle"
          onClick={() => onToggleSection("details")}
          aria-expanded={Boolean(openSections.details)}
        >
          <div>
            <p className="eyebrow">Breakdown</p>
            <h2>Category totals by month</h2>
          </div>
          <span className="month-toggle-indicator">{openSections.details ? "Hide" : "Show"}</span>
        </button>

        {openSections.details && (
          <div className="details-stack">
            {months.map((month) => (
              <article className="month-section" key={month.month}>
                <button
                  type="button"
                  className="month-section-header"
                  onClick={() => onToggleMonth(month.month)}
                  aria-expanded={Boolean(openMonths[month.month])}
                >
                  <div>
                    <p className="month-label">Month</p>
                    <h3 className="month-title">{month.month}</h3>
                  </div>

                  <div className="month-inline-totals">
                    <span>
                      Income <strong className="amount-income">{formatCurrency(month.income)}</strong>
                    </span>
                    <span>
                      Expense <strong className="amount-expense">{formatCurrency(month.expense)}</strong>
                    </span>
                  </div>
                  <span className="month-toggle-indicator">{openMonths[month.month] ? "Hide" : "Show"}</span>
                </button>

                {openMonths[month.month] && (
                  <div className="breakdown-stack">
                    <div className="table-wrap">
                      <div className="breakdown-header">
                        <span>Income</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Note Category</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(splitIncomeTransactions ? month.incomeRows : month.categories.filter((entry) => entry.type === "income")).map(
                            (entry, index) => (
                              <tr key={`${month.month}-income-${entry.note}-${entry.date ?? index}-${entry.total ?? entry.amount}`}>
                                <td>{splitIncomeTransactions ? formatIncomeRowLabel(entry) : entry.note}</td>
                                <td className="amount-income">
                                  {formatCurrency(splitIncomeTransactions ? entry.amount : entry.total)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="table-wrap">
                      <div className="breakdown-header">
                        <span>Expense</span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Note Category</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.categories
                            .filter((entry) => entry.type === "expense")
                            .map((entry) => (
                              <tr key={`${month.month}-${entry.type}-${entry.note}`}>
                                <td>{entry.note}</td>
                                <td className="amount-expense">{formatCurrency(entry.total)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {showCourseExpenseSplit && (
                      <div className="table-wrap">
                        <div className="breakdown-header">
                          <span>Expense split</span>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {buildCourseExpenseSplit(month.categories).map((entry) => (
                            <tr key={`${month.month}-course-split-${entry.label}`}>
                                <td>
                                  {entry.expandable ? (
                                    <button
                                      type="button"
                                      className="inline-row-toggle"
                                      onClick={() =>
                                        setOpenFixedCostMonths((current) => ({
                                          ...current,
                                          [month.month]: !current[month.month],
                                        }))
                                      }
                                    >
                                      <span>{entry.label}</span>
                                      <span className="inline-row-toggle-text">
                                        {openFixedCostMonths[month.month] ? "Hide" : "Show"}
                                      </span>
                                    </button>
                                  ) : (
                                    entry.label
                                  )}
                                </td>
                                <td className="amount-expense">{formatCurrency(entry.total)}</td>
                              </tr>
                            ))}

                            {openFixedCostMonths[month.month] &&
                              month.fixedCostRows.map((entry, index) => (
                                <tr key={`${month.month}-fixed-cost-${entry.note}-${entry.date}-${index}`}>
                                  <td className="detail-row-label">{formatExpenseRowLabel(entry)}</td>
                                  <td className="amount-expense">{formatCurrency(entry.amount)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function filterCourseRows(rows) {
  return rows.filter((row) => {
    const normalizedType = row.type.toLowerCase();

    if (normalizedType === "expense") {
      return row.note.toLowerCase().startsWith("course excel");
    }

    if (normalizedType === "income") {
      return row.category.toLowerCase() === "sold excel course";
    }

    return false;
  });
}

function parseRows(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("The uploaded file is empty.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = splitLine(lines[0], delimiter);
  const columnIndex = Object.fromEntries(header.map((name, index) => [name.trim(), index]));

  for (const column of REQUIRED_COLUMNS) {
    if (!(column in columnIndex)) {
      throw new Error(`Missing required column: ${column}`);
    }
  }

  const headerSignature = header.join("|").toLowerCase();

  return lines
    .slice(1)
    .map((line) => splitLine(line, delimiter))
    .filter((parts) => parts.length >= header.length)
    .filter((parts) => parts.join("|").toLowerCase() !== headerSignature)
    .map((parts) => ({
      date: (parts[columnIndex.Date] || "").trim(),
      category: (parts[columnIndex.Category] || "").trim(),
      month: (parts[columnIndex.Month] || "").trim(),
      note: (parts[columnIndex.Note] || "").trim() || "Uncategorized",
      type: (parts[columnIndex["Income/Expense"]] || "").trim(),
      amount: parseNumber(parts[columnIndex.Amount]),
    }))
    .filter((row) => {
      const normalizedType = row.type.toLowerCase();
      return row.month && Number.isFinite(row.amount) && (normalizedType === "income" || normalizedType === "expense");
    });
}

function detectDelimiter(line) {
  return line.includes("\t") ? "\t" : ",";
}

function splitLine(line, delimiter) {
  if (delimiter === "\t") {
    return line.split("\t");
  }

  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseNumber(value) {
  const cleaned = String(value || "").replace(/,/g, "").trim();
  return Number.parseFloat(cleaned);
}

function buildMonthlyGroups(rows) {
  const monthMap = new Map();

  for (const row of rows) {
    if (!monthMap.has(row.month)) {
        monthMap.set(row.month, {
          month: row.month,
          income: 0,
          expense: 0,
          categories: new Map(),
          incomeRows: [],
          expenseRows: [],
        });
      }

    const bucket = monthMap.get(row.month);
    const normalizedType = row.type.toLowerCase();
    const categoryKey = `${normalizedType}::${row.note}`;

    if (normalizedType === "income") {
      bucket.income += row.amount;
      bucket.incomeRows.push({
        date: row.date,
        note: row.note,
        amount: row.amount,
      });
    } else if (normalizedType === "expense") {
      bucket.expense += row.amount;
      bucket.expenseRows.push({
        date: row.date,
        note: row.note,
        amount: row.amount,
      });
    } else {
      continue;
    }

    if (!bucket.categories.has(categoryKey)) {
      bucket.categories.set(categoryKey, {
        note: row.note,
        type: normalizedType,
        total: 0,
      });
    }

    bucket.categories.get(categoryKey).total += row.amount;
  }

  return [...monthMap.values()]
    .sort((left, right) => monthOrderValue(right.month) - monthOrderValue(left.month))
    .map((month) => ({
      ...month,
      net: month.income - month.expense,
      categories: [...month.categories.values()].sort((left, right) => right.total - left.total),
      incomeRows: month.incomeRows.sort(
        (left, right) => right.amount - left.amount || dateOrderValue(right.date) - dateOrderValue(left.date),
      ),
      fixedCostRows: buildFixedCostRows(month.expenseRows),
    }));
}

function buildExpenseSplitMonths(rows) {
  const monthMap = new Map();

  rows.forEach((row) => {
    if (row.type.toLowerCase() !== "expense") {
      return;
    }

    if (!monthMap.has(row.month)) {
      monthMap.set(row.month, {
        month: row.month,
        courseExcelExpense: 0,
        regularExpense: 0,
        courseExcelRows: [],
        regularExpenseRows: [],
      });
    }

    const bucket = monthMap.get(row.month);
    if (row.note.toLowerCase().startsWith("course excel")) {
      bucket.courseExcelExpense += row.amount;
      bucket.courseExcelRows.push(row);
    } else {
      bucket.regularExpense += row.amount;
      bucket.regularExpenseRows.push(row);
    }
  });

  return [...monthMap.values()]
    .sort((left, right) => monthOrderValue(right.month) - monthOrderValue(left.month))
    .map((month) => ({
      ...month,
      courseExcelRows: buildGroupedRows(month.courseExcelRows),
      regularExpenseRows: buildGroupedRows(month.regularExpenseRows),
    }));
}

function buildGroupedRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.note)) {
      grouped.set(row.note, {
        note: row.note,
        amount: 0,
      });
    }

    grouped.get(row.note).amount += row.amount;
  });

  return [...grouped.values()].sort((left, right) => right.amount - left.amount || left.note.localeCompare(right.note));
}

function buildCoursePerformance(rows) {
  let totalExpenses = 0;
  let totalIncome = 0;

  rows.forEach((row) => {
    if (row.type.toLowerCase() === "expense") {
      totalExpenses += row.amount;
    } else if (row.type.toLowerCase() === "income") {
      totalIncome += row.amount;
    }
  });

  const remainingExpenses = totalExpenses - totalIncome;
  const expensePercentage = totalExpenses === 0 ? 0 : (totalIncome / totalExpenses) * 100;
  const largestMagnitude = Math.max(Math.abs(totalExpenses), Math.abs(totalIncome), Math.abs(remainingExpenses), 1);

  return {
    totalExpenses,
    totalIncome,
    remainingExpenses,
    expensePercentage,
    chartBars: [
      {
        label: "Total expenses",
        value: totalExpenses,
        heightPercent: (Math.abs(totalExpenses) / largestMagnitude) * 100,
        className: "amount-expense",
      },
      {
        label: "Total income",
        value: totalIncome,
        heightPercent: (Math.abs(totalIncome) / largestMagnitude) * 100,
        className: "amount-income",
      },
      {
        label: "Remaining expenses",
        value: remainingExpenses,
        heightPercent: (Math.abs(remainingExpenses) / largestMagnitude) * 100,
        className: remainingExpenses >= 0 ? "amount-expense" : "amount-income",
      },
    ],
  };
}

function monthOrderValue(label) {
  const parsed = Date.parse(`01-${label}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function dateOrderValue(label) {
  const parsed = Date.parse(label);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatIncomeRowLabel(entry) {
  return entry.date ? `${entry.note} · ${formatDisplayDate(entry.date)}` : entry.note;
}

function formatExpenseRowLabel(entry) {
  return entry.note;
}

function formatDisplayDate(label) {
  const match = String(label).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    return label;
  }

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return `${day}/${month}/${year}`;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(date);
}

function buildCourseExpenseSplit(categories) {
  let facebookAds = 0;
  let fixedCost = 0;

  categories
    .filter((entry) => entry.type === "expense")
    .forEach((entry) => {
      if (entry.note.toLowerCase() === "course excel facebook ads") {
        facebookAds += entry.total;
      } else {
        fixedCost += entry.total;
      }
    });

  return [
    { label: "Facebook ads", total: facebookAds },
    { label: "Fixed cost", total: fixedCost, expandable: true },
  ];
}

function buildFixedCostRows(expenseRows) {
  const grouped = new Map();

  expenseRows
    .filter((entry) => entry.note.toLowerCase() !== "course excel facebook ads")
    .forEach((entry) => {
      if (!grouped.has(entry.note)) {
        grouped.set(entry.note, {
          note: entry.note,
          amount: 0,
        });
      }

      grouped.get(entry.note).amount += entry.amount;
    });

  return [...grouped.values()].sort((left, right) => right.amount - left.amount || left.note.localeCompare(right.note));
}
