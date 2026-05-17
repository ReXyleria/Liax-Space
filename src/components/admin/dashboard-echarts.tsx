"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import type { DashboardStats } from "@/features/analytics/types";

type DashboardEchartsProps = Pick<
  DashboardStats,
  "rangeDays" | "visitTrend" | "countryTimeline" | "deviceSources"
> & { locale: Locale };

const RANGE_OPTIONS: DashboardStats["rangeDays"][] = [7, 14, 30];

function useChart(ref: React.RefObject<HTMLDivElement | null>, option: echarts.EChartsOption) {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const chart = echarts.init(element);
    chart.setOption(option);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [ref, option]);
}

function getVisitTrendOption(visitTrend: DashboardStats["visitTrend"]): echarts.EChartsOption {
  return {
    grid: { left: 36, right: 18, top: 28, bottom: 36 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: visitTrend.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: "#d4d4d8" } },
      axisTick: { show: false }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#ececf1" } }
    },
    series: [
      {
        name: "访问量",
        type: "line",
        smooth: true,
        symbolSize: 7,
        data: visitTrend.map((item) => item.count),
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(37, 99, 235, 0.36)" },
            { offset: 1, color: "rgba(37, 99, 235, 0.03)" }
          ])
        },
        lineStyle: { width: 3, color: "#2563eb" },
        itemStyle: { color: "#2563eb" }
      }
    ]
  };
}

function getCountryOption(countryTimeline: DashboardStats["countryTimeline"]): echarts.EChartsOption {
  const timeline = countryTimeline.length
    ? countryTimeline
    : [{ date: "No data", countries: [{ countryCode: "Unknown", count: 0 }] }];

  return {
    baseOption: {
      timeline: {
        axisType: "category",
        autoPlay: true,
        playInterval: 1800,
        bottom: 0,
        data: timeline.map((item) => item.date.slice(5)),
        label: { color: "#71717a" },
        lineStyle: { color: "#d4d4d8" },
        checkpointStyle: { color: "#0f766e" }
      },
      grid: { left: 58, right: 24, top: 18, bottom: 58 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#ececf1" } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#52525b" }
      },
      series: [
        {
          type: "bar",
          realtimeSort: true,
          barMaxWidth: 24,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#14b8a6" },
              { offset: 1, color: "#0f766e" }
            ])
          },
          label: {
            show: true,
            position: "right",
            color: "#52525b",
            fontWeight: 600
          }
        }
      ],
      animationDurationUpdate: 800,
      animationEasingUpdate: "quinticInOut"
    },
    options: timeline.map((item) => ({
      yAxis: { data: item.countries.map((country) => country.countryCode) },
      series: [{ data: item.countries.map((country) => country.count) }]
    }))
  };
}

function getDeviceSourceOption(deviceSources: DashboardStats["deviceSources"]): echarts.EChartsOption {
  const data = deviceSources.length ? deviceSources : [{ name: "No data", value: 0 }];

  return {
    color: ["#2563eb", "#0f766e", "#f59e0b", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#64748b"],
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      type: "scroll",
      textStyle: { color: "#52525b" }
    },
    series: [
      {
        name: "Device",
        type: "pie",
        radius: ["16%", "68%"],
        center: ["50%", "45%"],
        roseType: "area",
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { color: "#3f3f46" },
        data
      }
    ]
  };
}

export function DashboardEcharts({
  rangeDays,
  visitTrend,
  countryTimeline,
  deviceSources,
  locale
}: DashboardEchartsProps) {
  const visitRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const visitOption = useMemo(() => getVisitTrendOption(visitTrend), [visitTrend]);
  const countryOption = useMemo(() => getCountryOption(countryTimeline), [countryTimeline]);
  const sourceOption = useMemo(() => getDeviceSourceOption(deviceSources), [deviceSources]);

  useChart(visitRef, visitOption);
  useChart(countryRef, countryOption);
  useChart(sourceRef, sourceOption);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t(locale, "adminAnalytics")}</h2>
          <p className="text-sm text-muted-foreground">{t(locale, "adminAnalyticsDescription")}</p>
        </div>
        <div className="inline-flex w-fit rounded-lg border bg-card p-1">
          {RANGE_OPTIONS.map((range) => (
            <Link
              key={range}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                rangeDays === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              href={`/admin?range=${range}`}
            >
              {range} {t(locale, "adminDays")}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t(locale, "adminDailyVisits")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={visitRef} className="h-[320px] w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t(locale, "adminCountryRanking")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={countryRef} className="h-[320px] w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t(locale, "adminDeviceRatio")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={sourceRef} className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
