import React, { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Feather, Ionicons } from './components/Icons';
import { Header } from './components/Header';
import { DuolingoStreakSection } from './components/DuolingoStreakSection';
import type { ChartDataPoint, DashboardStats, Deck } from '../domain/types';
import { CardRepository } from '../data/repositories';

interface DashboardProps {
  decks: Deck[];
  onOpenDrawer: () => void;
}

type ChartTab = 'cumulative' | 'reviews' | 'retention' | 'time' | 'forecast' | 'intervals';

export function Dashboard({ decks, onOpenDrawer }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<'today' | '7days' | '30days'>('today');
  const [overviewRange, setOverviewRange] = useState('7 ngày qua');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>('cumulative');
  const [selectedHeatDate, setSelectedHeatDate] = useState<string | null>(null);

  const [showDeckFilterModal, setShowDeckFilterModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showOverviewRangeModal, setShowOverviewRangeModal] = useState(false);
  const [showStreakDetailModal, setShowStreakDetailModal] = useState(false);

  useEffect(() => {
    loadStats();
  }, [selectedDeckId]);

  const loadStats = async () => {
    const data = await CardRepository.getDashboardStats(selectedDeckId);
    setStats(data);
  };

  const selectedDeckName = decks.find(d => d.id === selectedDeckId)?.name || 'Tất cả bộ thẻ';

  // Render Heatmap Grid
  const renderHeatmap = () => {
    const weeks = 28;
    const now = new Date();
    const grid: { dateStr: string; count: number; dayIndex: number }[][] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const weekDays: { dateStr: string; count: number; dayIndex: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(now.getDate() - (w * 7 + (6 - d)));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const count = stats?.activityHeatmap[key] || 0;
        weekDays.push({ dateStr: key, count, dayIndex: d });
      }
      grid.push(weekDays);
    }

    return (
      <View style={styles.heatmapWrapper}>
        <View style={styles.heatmapDayLabels}>
          <Text style={styles.dayLabel}>T2</Text>
          <Text style={styles.dayLabel}>T4</Text>
          <Text style={styles.dayLabel}>T6</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heatmapGridScroll}>
          <View>
            {/* Month labels */}
            <View style={styles.monthLabelsRow}>
              <Text style={styles.monthLabel}>Th1</Text>
              <Text style={styles.monthLabel}>Th2</Text>
              <Text style={styles.monthLabel}>Th3</Text>
              <Text style={styles.monthLabel}>Th4</Text>
              <Text style={styles.monthLabel}>Th5</Text>
              <Text style={styles.monthLabel}>Th6</Text>
            </View>

            {/* Squares grid */}
            <View style={styles.gridColumnsRow}>
              {grid.map((week, wIdx) => (
                <View key={wIdx} style={styles.weekColumn}>
                  {week.map((day, dIdx) => {
                    let tileColor = '#EAEAEA';
                    if (day.count > 0 && day.count <= 2) tileColor = '#C6C6C6';
                    else if (day.count > 2 && day.count <= 5) tileColor = '#8A8A8A';
                    else if (day.count > 5) tileColor = '#2F2F2F';

                    return (
                      <TouchableOpacity
                        key={dIdx}
                        onPress={() => setSelectedHeatDate(`${day.dateStr}: ${day.count} lượt ôn`)}
                      >
                        <View style={[styles.heatTile, { backgroundColor: tileColor }]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render Bar Charts
  const renderCurrentChart = () => {
    let data: ChartDataPoint[] = [];
    let unit = '';
    let description = '';
    let barColor = '#2B2B2B';

    if (activeChartTab === 'cumulative') {
      data = stats?.cumulativeLearnedChart || [];
      unit = 'thẻ';
      description = 'Tổng tích lũy số thẻ đã ghi nhớ theo thời gian';
    } else if (activeChartTab === 'reviews') {
      data = stats?.reviewsChart || [];
      unit = 'lượt';
      description = 'Số lượt thẻ ôn tập thực tế mỗi ngày';
    } else if (activeChartTab === 'retention') {
      data = stats?.retentionChart || [];
      unit = '%';
      description = 'Tỉ lệ phần trăm nhớ đúng chính xác';
      barColor = '#2ECC71';
    } else if (activeChartTab === 'time') {
      data = stats?.reviewTimeChart || [];
      unit = 'phút';
      description = 'Thời gian ước tính đã dành để học và ôn thẻ';
      barColor = '#4A90E2';
    } else if (activeChartTab === 'forecast') {
      data = stats?.reviewForecastChart || [];
      unit = 'thẻ';
      description = 'Dự báo số thẻ sẽ đến hạn ôn trong 7 ngày tới';
      barColor = '#E67E22';
    } else if (activeChartTab === 'intervals') {
      data = stats?.intervalsDistribution || [];
      unit = 'thẻ';
      description = 'Phân bố độ bền trí nhớ theo các khoảng chu kỳ lặp lại';
      barColor = '#8E44AD';
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartDescription}>{description}</Text>

        <View style={styles.chartBarsContainer}>
          {data.map((item, idx) => {
            const heightPercent = Math.max(8, Math.round((item.value / maxValue) * 100));
            return (
              <View key={idx} style={styles.barColumn}>
                <Text style={styles.barTopValue}>
                  {item.value}
                  {unit === '%' ? '%' : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPercent}%`, backgroundColor: barColor }
                    ]}
                  />
                </View>
                <Text numberOfLines={1} style={styles.barBottomLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        onOpenDrawer={onOpenDrawer}
        title="Thống kê"
        iconName="trending"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Streak Summary Banner (bấm vào để mở riêng màn hình Lịch Streak) */}
        <TouchableOpacity
          style={styles.streakBannerCard}
          activeOpacity={0.8}
          onPress={() => setShowStreakDetailModal(true)}
        >
          <View style={styles.streakBannerLeft}>
            <View style={[styles.streakFlameCircle, stats?.isStreakFrozen && styles.streakFlameCircleFrozen]}>
              <Text style={styles.streakFlameEmoji}>{stats?.isStreakFrozen ? '❄️' : '🔥'}</Text>
            </View>
            <View style={styles.streakBannerTextCol}>
              <View style={styles.streakNumberRow}>
                <Text style={[styles.streakBigNumber, stats?.isStreakFrozen && { color: '#49C0F8' }]}>
                  {stats?.streakDays ?? 0}
                </Text>
                <Text style={styles.streakUnitText}>ngày streak!</Text>
              </View>
              <Text style={styles.streakHintSub}>
                {stats?.isStreakActiveToday
                  ? 'Đã học hôm nay! Chạm để xem chi tiết lịch →'
                  : stats?.isStreakFrozen
                  ? 'Chuỗi đang đóng băng! Chạm xem lịch →'
                  : 'Bắt đầu chuỗi hôm nay! Chạm xem lịch →'}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#888888" />
        </TouchableOpacity>

        {/* Period dropdown */}
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowPeriodModal(true)}
        >
          <Text style={styles.dropdownButtonText}>
            {period === 'today' ? 'Hôm nay' : period === '7days' ? '7 ngày qua' : '30 ngày qua'}
          </Text>
          <Feather name="chevron-down" size={17} color="#333333" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {/* 3 KPI Summary Card (Dữ liệu thật 100%) */}
        <View style={styles.summaryCard}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Thẻ đã học</Text>
            <Text style={styles.kpiValue}>{stats ? stats.cardsLearned : 0}</Text>
          </View>

          <View style={styles.kpiDivider} />

          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Tỉ lệ ghi nhớ</Text>
            <Text style={styles.kpiValue}>{stats ? stats.retentionRate : 0}%</Text>
          </View>

          <View style={styles.kpiDivider} />

          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Tổng lượt ôn</Text>
            <Text style={styles.kpiValue}>{stats ? stats.totalReviews : 0}</Text>
          </View>
        </View>

        {/* Overview Section */}
        <Text style={styles.sectionHeading}>Tổng quan</Text>

        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={styles.filterPill}
            onPress={() => setShowOverviewRangeModal(true)}
          >
            <Text style={styles.filterPillText}>{overviewRange}</Text>
            <Feather name="chevron-down" size={15} color="#555555" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterPill}
            onPress={() => setShowDeckFilterModal(true)}
          >
            <Feather name="settings" size={13} color="#555555" style={{ marginRight: 6 }} />
            <Text style={styles.filterPillText}>{selectedDeckName}</Text>
            <Feather name="chevron-down" size={15} color="#555555" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />

        {/* Review Activity Section */}
        <Text style={styles.subHeading}>Hoạt động ôn tập</Text>

        <View style={styles.activityInfoRow}>
          <TouchableOpacity style={styles.yearPill}>
            <Text style={styles.yearPillText}>{selectedYear}</Text>
            <Feather name="chevron-down" size={14} color="#555555" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <Text style={styles.activityStatsText}>
            {stats ? stats.totalReviewYearCount : 0} lượt ôn qua {stats ? stats.totalDaysSpan : 1} ngày · {stats ? stats.activeDaysCount : 0} ngày hoạt động
          </Text>
        </View>

        {/* Heatmap Grid */}
        {renderHeatmap()}

        {selectedHeatDate && (
          <Text style={styles.selectedHeatDateText}>{selectedHeatDate}</Text>
        )}

        {/* Heatmap legend */}
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Ít hơn</Text>
          <View style={[styles.legendTile, { backgroundColor: '#EAEAEA' }]} />
          <View style={[styles.legendTile, { backgroundColor: '#C6C6C6' }]} />
          <View style={[styles.legendTile, { backgroundColor: '#8A8A8A' }]} />
          <View style={[styles.legendTile, { backgroundColor: '#2F2F2F' }]} />
          <Text style={styles.legendText}>Nhiều hơn</Text>
        </View>

        {/* Comprehensive Charts Section */}
        <View style={styles.chartsSectionContainer}>
          <View style={styles.chartsHeaderRow}>
            <Text style={styles.chartsSectionHeading}>Phân tích học tập</Text>
          </View>

          {/* Chart Tabs Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartTabsScroll}
          >
            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'cumulative' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('cumulative')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'cumulative' && styles.chartTabBtnTextActive]}>
                Thẻ đã học
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'reviews' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('reviews')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'reviews' && styles.chartTabBtnTextActive]}>
                Lượt ôn tập
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'retention' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('retention')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'retention' && styles.chartTabBtnTextActive]}>
                Tỉ lệ nhớ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'time' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('time')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'time' && styles.chartTabBtnTextActive]}>
                Thời gian học
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'forecast' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('forecast')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'forecast' && styles.chartTabBtnTextActive]}>
                Dự báo ôn tập
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chartTabBtn, activeChartTab === 'intervals' && styles.chartTabBtnActive]}
              onPress={() => setActiveChartTab('intervals')}
            >
              <Text style={[styles.chartTabBtnText, activeChartTab === 'intervals' && styles.chartTabBtnTextActive]}>
                Chu kỳ nhớ
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Render Active Chart */}
          {renderCurrentChart()}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Period Selection Modal */}
      <Modal visible={showPeriodModal} transparent animationType="fade" onRequestClose={() => setShowPeriodModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowPeriodModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Chọn khoảng thời gian</Text>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setPeriod('today'); setShowPeriodModal(false); }}
                >
                  <Text style={[styles.modalOptionText, period === 'today' && styles.modalOptionActive]}>Hôm nay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setPeriod('7days'); setShowPeriodModal(false); }}
                >
                  <Text style={[styles.modalOptionText, period === '7days' && styles.modalOptionActive]}>7 ngày qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setPeriod('30days'); setShowPeriodModal(false); }}
                >
                  <Text style={[styles.modalOptionText, period === '30days' && styles.modalOptionActive]}>30 ngày qua</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Deck Filter Modal */}
      <Modal visible={showDeckFilterModal} transparent animationType="fade" onRequestClose={() => setShowDeckFilterModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowDeckFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Lọc theo bộ thẻ</Text>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setSelectedDeckId(undefined); setShowDeckFilterModal(false); }}
                >
                  <Text style={[styles.modalOptionText, !selectedDeckId && styles.modalOptionActive]}>Tất cả bộ thẻ</Text>
                </TouchableOpacity>
                {decks.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.modalOption}
                    onPress={() => { setSelectedDeckId(d.id); setShowDeckFilterModal(false); }}
                  >
                    <Text style={[styles.modalOptionText, selectedDeckId === d.id && styles.modalOptionActive]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Overview Range Modal */}
      <Modal visible={showOverviewRangeModal} transparent animationType="fade" onRequestClose={() => setShowOverviewRangeModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowOverviewRangeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Khung thời gian tổng quan</Text>
                {['7 ngày qua', '14 ngày qua', '30 ngày qua', 'Tất cả'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={styles.modalOption}
                    onPress={() => { setOverviewRange(r); setShowOverviewRangeModal(false); }}
                  >
                    <Text style={[styles.modalOptionText, overviewRange === r && styles.modalOptionActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Màn hình chi tiết Lịch Streak (giao diện Duolingo) mở khi ấn vào số ngày streak */}
      <Modal
        visible={showStreakDetailModal}
        animationType="slide"
        onRequestClose={() => setShowStreakDetailModal(false)}
      >
        <SafeAreaView style={styles.streakModalContainer}>
          {/* Header với nút quay lại Dashboard */}
          <View style={styles.streakModalHeader}>
            <TouchableOpacity
              style={styles.streakModalBackBtn}
              onPress={() => setShowStreakDetailModal(false)}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.streakModalBackText}>Thống kê</Text>
            </TouchableOpacity>
            <Text style={styles.streakModalHeaderTitle}>Lịch Streak</Text>
            <TouchableOpacity
              style={styles.streakModalCloseBtn}
              onPress={() => setShowStreakDetailModal(false)}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.streakModalScroll}>
            <DuolingoStreakSection
              streakDays={stats?.streakDays ?? 0}
              isStreakActiveToday={stats?.isStreakActiveToday ?? false}
              isStreakFrozen={stats?.isStreakFrozen ?? false}
              activeDates={stats?.activeDates ?? []}
              frozenDates={stats?.streakFrozenDates ?? []}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  streakBannerCard: {
    backgroundColor: '#131F24',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3
  },
  streakBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  streakFlameCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 150, 0, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FF9600',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  streakFlameCircleFrozen: {
    backgroundColor: 'rgba(73, 192, 248, 0.15)',
    borderColor: '#49C0F8'
  },
  streakFlameEmoji: {
    fontSize: 22
  },
  streakBannerTextCol: {
    flex: 1
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  streakBigNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF9600',
    marginRight: 6
  },
  streakUnitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  streakHintSub: {
    fontSize: 12,
    color: '#8E9AA0',
    marginTop: 2
  },
  streakModalContainer: {
    flex: 1,
    backgroundColor: '#131F24'
  },
  streakModalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2B383E',
    backgroundColor: '#131F24'
  },
  streakModalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12
  },
  streakModalBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  streakModalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  streakModalCloseBtn: {
    padding: 6
  },
  streakModalScroll: {
    paddingBottom: 40
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  dropdownButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#242424'
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kpiLabel: {
    fontSize: 12,
    color: '#777777',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1E1E'
  },
  kpiDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 14
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333'
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginVertical: 12
  },
  subHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 10
  },
  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333'
  },
  activityStatsText: {
    fontSize: 13,
    color: '#666666',
    flex: 1
  },
  heatmapWrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  heatmapDayLabels: {
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingRight: 6,
    height: 94
  },
  dayLabel: {
    fontSize: 9.5,
    color: '#888888',
    fontWeight: '600'
  },
  heatmapGridScroll: {
    paddingLeft: 4
  },
  monthLabelsRow: {
    flexDirection: 'row',
    gap: 36,
    marginBottom: 6
  },
  monthLabel: {
    fontSize: 10.5,
    color: '#888888',
    fontWeight: '600'
  },
  gridColumnsRow: {
    flexDirection: 'row',
    gap: 3
  },
  weekColumn: {
    flexDirection: 'column',
    gap: 3
  },
  heatTile: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  selectedHeatDateText: {
    fontSize: 12,
    color: '#444444',
    marginBottom: 8,
    marginLeft: 4
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 24
  },
  legendText: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500'
  },
  legendTile: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  chartsSectionContainer: {
    marginTop: 4
  },
  chartsHeaderRow: {
    marginBottom: 10
  },
  chartsSectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222'
  },
  chartTabsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 12
  },
  chartTabBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  chartTabBtnActive: {
    backgroundColor: '#262626',
    borderColor: '#262626'
  },
  chartTabBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555'
  },
  chartTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  chartDescription: {
    fontSize: 13,
    color: '#777777',
    marginBottom: 16
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    paddingTop: 16,
    paddingBottom: 4
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end'
  },
  barTopValue: {
    fontSize: 10,
    color: '#777777',
    fontWeight: '600',
    marginBottom: 4
  },
  barTrack: {
    width: 14,
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    width: '100%',
    borderRadius: 7
  },
  barBottomLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
    marginTop: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalBox: {
    width: '85%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 8
  },
  modalOption: {
    paddingVertical: 10
  },
  modalOptionText: {
    fontSize: 15,
    color: '#444444'
  },
  modalOptionActive: {
    fontWeight: '700',
    color: '#111111'
  }
});
