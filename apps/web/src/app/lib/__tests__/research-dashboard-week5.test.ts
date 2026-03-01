import { describe, it, expect } from 'vitest';

/**
 * Unit tests for Week 5 Research Dashboard logic
 * These test the data transformation logic in isolation
 */

// Replicate the HDI binning logic
type HDIBin = { range: string; min: number; max: number; count: number };
type HDIDataPoint = { hdi: number; learnerId: string; timestamp: number };

function calculateHDIBins_original(hdiDataPoints: HDIDataPoint[]): HDIBin[] {
  const hdiBins: HDIBin[] = [
    { range: '0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 }
  ];
  
  hdiDataPoints.forEach(point => {
    const bin = hdiBins.find(b => point.hdi >= b.min && point.hdi < b.max);
    if (bin) bin.count++;
  });
  
  return hdiBins;
}

function calculateHDIBins_fixed(hdiDataPoints: HDIDataPoint[]): HDIBin[] {
  const hdiBins: HDIBin[] = [
    { range: '0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 }
  ];
  
  hdiDataPoints.forEach(point => {
    // Handle edge case: HDI = 1.0 should go into the 0.8-1.0 bin
    const bin = hdiBins.find(b => 
      point.hdi >= b.min && (point.hdi < b.max || (point.hdi === 1.0 && b.max === 1.0))
    );
    if (bin) bin.count++;
  });
  
  return hdiBins;
}

// Bandit mean reward calculation
type BanditArmData = { armId: string; selectionCount: number; meanReward: number };

function calculateBanditData(
  armSelectionCounts: Record<string, number>,
  armRewardSums: Record<string, number>,
  armRewardCounts: Record<string, number>
): BanditArmData[] {
  return Object.keys(armSelectionCounts).map(armId => ({
    armId,
    selectionCount: armSelectionCounts[armId] || 0,
    meanReward: armRewardCounts[armId] ? (armRewardSums[armId] / armRewardCounts[armId]) : 0
  })).sort((a, b) => b.selectionCount - a.selectionCount);
}

// Profile effectiveness sorting
type ProfileEffectiveness = {
  profile: string;
  learnerCount: number;
  avgSuccessRate: number;
  avgEscalations: number;
  totalInteractions: number;
};

describe('@weekly Week 5 Analytics Logic', () => {
  describe('HDI Binning', () => {
    it('BUG: HDI = 1.0 is lost with original logic', () => {
      const dataPoints: HDIDataPoint[] = [
        { hdi: 0, learnerId: 'l1', timestamp: Date.now() },
        { hdi: 0.5, learnerId: 'l2', timestamp: Date.now() },
        { hdi: 1.0, learnerId: 'l3', timestamp: Date.now() } // Edge case!
      ];
      
      const bins = calculateHDIBins_original(dataPoints);
      const lastBin = bins[bins.length - 1];
      
      // BUG: HDI = 1.0 falls outside all bins due to strict < comparison
      expect(lastBin.count).toBe(0); // This shows the bug!
      expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(2); // One point lost!
    });
    
    it('FIX: HDI = 1.0 is correctly counted with fixed logic', () => {
      const dataPoints: HDIDataPoint[] = [
        { hdi: 0, learnerId: 'l1', timestamp: Date.now() },
        { hdi: 0.5, learnerId: 'l2', timestamp: Date.now() },
        { hdi: 1.0, learnerId: 'l3', timestamp: Date.now() } // Edge case handled!
      ];
      
      const bins = calculateHDIBins_fixed(dataPoints);
      const lastBin = bins[bins.length - 1];
      
      // FIX: HDI = 1.0 goes into 0.8-1.0 bin
      expect(lastBin.count).toBe(1);
      expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(3); // All points counted!
    });
    
    it('handles HDI = 0.99 correctly in 0.8-1.0 bin', () => {
      const dataPoints: HDIDataPoint[] = [
        { hdi: 0.81, learnerId: 'l1', timestamp: Date.now() },
        { hdi: 0.95, learnerId: 'l2', timestamp: Date.now() },
        { hdi: 0.99, learnerId: 'l3', timestamp: Date.now() }
      ];
      
      const bins = calculateHDIBins_fixed(dataPoints);
      const lastBin = bins[bins.length - 1];
      
      expect(lastBin.count).toBe(3);
    });
    
    it('handles empty data gracefully', () => {
      const bins = calculateHDIBins_fixed([]);
      expect(bins.every(b => b.count === 0)).toBe(true);
    });
    
    it('handles 20+ data points with correct distribution', () => {
      const dataPoints: HDIDataPoint[] = Array.from({ length: 25 }, (_, i) => ({
        hdi: (i % 10) / 10, // 0.0, 0.1, 0.2, ..., 0.9 distributed
        learnerId: `learner-${i}`,
        timestamp: Date.now() + i * 100
      }));
      
      const bins = calculateHDIBins_fixed(dataPoints);
      const totalCounted = bins.reduce((sum, b) => sum + b.count, 0);
      
      expect(totalCounted).toBe(25);
      // Verify 0.0 goes to first bin (0.0, 0.1, 0.11, 0.12, 0.13, 0.14 - but since we use % 10, we get 0.0, 0.1, 0.2, etc)
      expect(bins[0].count).toBe(6); // 0.0, 0.1, and their multiples modulo 10
    });
  });

  describe('Bandit Performance', () => {
    it('handles zero pulls (no rewards) with meanReward = 0', () => {
      const armSelectionCounts = { 'arm1': 5, 'arm2': 3 };
      const armRewardSums: Record<string, number> = {}; // No rewards
      const armRewardCounts: Record<string, number> = {}; // No rewards
      
      const result = calculateBanditData(armSelectionCounts, armRewardSums, armRewardCounts);
      
      expect(result).toHaveLength(2);
      expect(result[0].meanReward).toBe(0); // Not NaN!
      expect(result[1].meanReward).toBe(0); // Not NaN!
    });
    
    it('handles negative rewards correctly', () => {
      const armSelectionCounts = { 'arm1': 2 };
      const armRewardSums = { 'arm1': -0.3 }; // -0.5 + 0.2
      const armRewardCounts = { 'arm1': 2 };
      
      const result = calculateBanditData(armSelectionCounts, armRewardSums, armRewardCounts);
      
      expect(result[0].meanReward).toBe(-0.15);
    });
    
    it('sorts by selection count descending', () => {
      const armSelectionCounts = { 'armC': 3, 'armA': 10, 'armB': 5 };
      const armRewardSums: Record<string, number> = {};
      const armRewardCounts: Record<string, number> = {};
      
      const result = calculateBanditData(armSelectionCounts, armRewardSums, armRewardCounts);
      
      expect(result[0].armId).toBe('armA'); // 10 selections
      expect(result[1].armId).toBe('armB'); // 5 selections
      expect(result[2].armId).toBe('armC'); // 3 selections
    });
  });

  describe('Profile Effectiveness Sorting', () => {
    it('sorts by avgSuccessRate descending (highest first)', () => {
      const profiles: ProfileEffectiveness[] = [
        { profile: 'SLOW', learnerCount: 3, avgSuccessRate: 40, avgEscalations: 2, totalInteractions: 30 },
        { profile: 'FAST', learnerCount: 5, avgSuccessRate: 85, avgEscalations: 1, totalInteractions: 50 },
        { profile: 'ADAPTIVE', learnerCount: 4, avgSuccessRate: 60, avgEscalations: 1.5, totalInteractions: 40 }
      ];
      
      const sorted = [...profiles].sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
      
      expect(sorted[0].profile).toBe('FAST');      // 85%
      expect(sorted[1].profile).toBe('ADAPTIVE');  // 60%
      expect(sorted[2].profile).toBe('SLOW');      // 40%
    });
    
    it('handles ties in success rate', () => {
      const profiles: ProfileEffectiveness[] = [
        { profile: 'SLOW', learnerCount: 3, avgSuccessRate: 70, avgEscalations: 2, totalInteractions: 30 },
        { profile: 'FAST', learnerCount: 5, avgSuccessRate: 70, avgEscalations: 1, totalInteractions: 50 },
      ];
      
      const sorted = [...profiles].sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
      
      // Both have 70%, order between them is stable
      expect(sorted[0].avgSuccessRate).toBe(70);
      expect(sorted[1].avgSuccessRate).toBe(70);
    });
    
    it('handles zero success rates', () => {
      const profiles: ProfileEffectiveness[] = [
        { profile: 'SLOW', learnerCount: 3, avgSuccessRate: 0, avgEscalations: 2, totalInteractions: 30 },
        { profile: 'FAST', learnerCount: 5, avgSuccessRate: 50, avgEscalations: 1, totalInteractions: 50 },
      ];
      
      const sorted = [...profiles].sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
      
      expect(sorted[0].profile).toBe('FAST');  // 50%
      expect(sorted[1].profile).toBe('SLOW');  // 0%
    });
  });

  describe('Null Safety', () => {
    it('handles null learnerId in alert display', () => {
      const learnerId: string | null = null;
      const displayId = (learnerId || 'unknown').slice(0, 8);
      
      expect(displayId).toBe('unknown');
      expect(() => displayId).not.toThrow();
    });
    
    it('handles undefined learnerId in alert display', () => {
      const learnerId: string | undefined = undefined;
      const displayId = (learnerId || 'unknown').slice(0, 8);
      
      expect(displayId).toBe('unknown');
    });
    
    it('handles normal learnerId in alert display', () => {
      const learnerId = 'learner-12345';
      const displayId = (learnerId || 'unknown').slice(0, 8);
      
      expect(displayId).toBe('learner-');
    });
  });

  describe('Success Rate Color Logic', () => {
    const getSuccessColor = (rate: number): string => {
      if (rate >= 70) return 'green';
      if (rate >= 40) return 'yellow';
      return 'red';
    };
    
    it('returns green for >= 70%', () => {
      expect(getSuccessColor(70)).toBe('green');
      expect(getSuccessColor(100)).toBe('green');
      expect(getSuccessColor(85)).toBe('green');
    });
    
    it('returns yellow for 40-69%', () => {
      expect(getSuccessColor(40)).toBe('yellow');
      expect(getSuccessColor(69)).toBe('yellow');
      expect(getSuccessColor(55)).toBe('yellow');
    });
    
    it('returns red for < 40%', () => {
      expect(getSuccessColor(39)).toBe('red');
      expect(getSuccessColor(0)).toBe('red');
      expect(getSuccessColor(20)).toBe('red');
    });
  });
});
