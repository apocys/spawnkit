---
name: data-analysis
description: "Analyze CSV, JSON, or tabular data — statistics, patterns, trends, and visualizations. Use when: user shares a data file or asks to analyze numbers, find patterns, create charts, or generate insights from data. NOT for: real-time streaming data, databases requiring SQL."
metadata: { "openclaw": { "emoji": "📊", "source": "awesome-llm-apps", "category": "data" } }
---

# Data Analysis Skill

Analyze structured data files and generate insights with statistics and visualizations.

## When to Use
- "Analyze this CSV/JSON file"
- "What patterns do you see in this data?"
- "Create a chart from this data"
- "Summarize these numbers"

## Workflow

### Phase 1: Data Ingestion
1. Read the file using `read` tool
2. Identify: columns/fields, data types, row count, missing values
3. Present a data summary to the user

### Phase 2: Exploratory Analysis
Use `exec` with Python (pandas/matplotlib) or Node.js:
1. Descriptive statistics (mean, median, std dev, min, max)
2. Distribution analysis (skewness, outliers)
3. Correlation between numeric columns
4. Time-series trends if date column exists
5. Group-by aggregations for categorical columns

### Phase 3: Insights
1. Top 3-5 findings from the data
2. Anomalies or outliers flagged
3. Trends over time (if applicable)
4. Correlations worth noting

### Phase 4: Visualization (if requested)
Generate charts using Python matplotlib/seaborn:
```python
import pandas as pd
import matplotlib.pyplot as plt
# Save to file for user to view
plt.savefig('analysis_chart.png', dpi=150, bbox_inches='tight')
```

### Output Format
```markdown
# Data Analysis Report
**File:** [filename] | **Rows:** X | **Columns:** X

## Summary Statistics
| Column | Type | Mean | Median | Min | Max | Missing |
|--------|------|------|--------|-----|-----|---------|

## Key Findings
1. [Finding with supporting numbers]

## Anomalies
- [Outlier or unexpected pattern]

## Recommendations
```
