/**
 * Learner Clustering Module
 * 
 * Groups learners by behavior patterns using k-means clustering
 * on extracted behavioral features.
 */

import type { InteractionEvent, LearnerProfile } from '../../types';
import { calculateHDI } from '../ml/hdi-calculator';

export interface LearnerCluster {
  id: string;
  name: string;
  centroids: {
    hdi: number;
    escalationRate: number;
    independence: number;
  };
  members: string[]; // Learner IDs
  characteristics: string[];
}

export interface LearnerFeatures {
  learnerId: string;
  hdi: number;
  totalInteractions: number;
  escalationRate: number;     // escalations / hints
  independence: number;       // success without hints
  avgTimeToSuccess: number;
  conceptCoverage: number;
  errorRate: number;
  textbookUsage: number;
}

interface Centroid {
  hdi: number;
  escalation: number;
  independence: number;
}

/**
 * Cluster learners by behavior patterns using k-means clustering
 */
export function clusterLearners(
  profiles: LearnerProfile[],
  interactions: InteractionEvent[],
  k: number = 3
): LearnerCluster[] {
  if (profiles.length === 0) {
    return [];
  }

  // Extract features for each learner
  const features: LearnerFeatures[] = profiles.map(profile => {
    const learnerInteractions = interactions.filter(i => i.learnerId === profile.id);
    return extractFeatures(profile, learnerInteractions);
  });

  if (features.length === 0) {
    return [];
  }

  // Simple k-means clustering
  const clusters = kMeansClustering(features, Math.min(k, features.length));

  // Label clusters by characteristics
  return clusters.map((cluster, idx) => ({
    id: `cluster-${idx}`,
    name: labelCluster(cluster),
    centroids: calculateCentroids(cluster),
    members: cluster.map(f => f.learnerId),
    characteristics: describeCluster(cluster)
  }));
}

function extractFeatures(
  profile: LearnerProfile,
  learnerInteractions: InteractionEvent[]
): LearnerFeatures {
  const hintRequests = learnerInteractions.filter(
    i => i.eventType === 'hint_request' || i.eventType === 'guidance_request' || i.eventType === 'hint_view'
  ).length;
  
  const escalations = learnerInteractions.filter(
    i => i.eventType === 'guidance_escalate' || i.eventType === 'explanation_view'
  ).length;
  
  const successes = learnerInteractions.filter(
    i => i.eventType === 'execution' && i.successful
  ).length;
  
  const errors = learnerInteractions.filter(
    i => i.eventType === 'error'
  ).length;

  const hdiResult = calculateHDI(learnerInteractions);

  return {
    learnerId: profile.id,
    hdi: hdiResult.hdi,
    totalInteractions: learnerInteractions.length,
    escalationRate: hintRequests > 0 ? escalations / hintRequests : 0,
    independence: successes / Math.max(1, successes + errors),
    avgTimeToSuccess: calculateAvgTimeToSuccess(learnerInteractions),
    conceptCoverage: profile.conceptsCovered?.size || 0,
    errorRate: errors / Math.max(1, learnerInteractions.length),
    textbookUsage: learnerInteractions.filter(
      i => i.eventType === 'textbook_unit_upsert' || i.eventType === 'textbook_add'
    ).length
  };
}

function calculateAvgTimeToSuccess(interactions: InteractionEvent[]): number {
  // Group by problem
  const problemAttempts = new Map<string, { start: number; success?: number }>();

  for (const interaction of interactions) {
    const pid = interaction.problemId;
    if (!problemAttempts.has(pid)) {
      problemAttempts.set(pid, { start: interaction.timestamp });
    }
    if (interaction.eventType === 'execution' && interaction.successful) {
      const attempt = problemAttempts.get(pid)!;
      if (!attempt.success) {
        attempt.success = interaction.timestamp;
      }
    }
  }

  let totalTime = 0;
  let count = 0;
  for (const [, attempt] of problemAttempts) {
    if (attempt.success) {
      totalTime += attempt.success - attempt.start;
      count++;
    }
  }

  return count > 0 ? totalTime / count : 0;
}

function kMeansClustering(features: LearnerFeatures[], k: number): LearnerFeatures[][] {
  const clusters: LearnerFeatures[][] = Array.from({ length: k }, () => []);
  
  if (features.length === 0) return clusters;

  // Initialize centroids using first k features (or fewer if not enough)
  let centroids: Centroid[] = features.slice(0, k).map(f => ({
    hdi: f.hdi,
    escalation: f.escalationRate,
    independence: f.independence
  }));

  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    // Clear clusters
    clusters.forEach(c => c.length = 0);

    // Assign each feature to the closest centroid
    for (const feature of features) {
      const distances = centroids.map(c => 
        Math.sqrt(
          Math.pow(c.hdi - feature.hdi, 2) +
          Math.pow(c.escalation - feature.escalationRate, 2) +
          Math.pow(c.independence - feature.independence, 2)
        )
      );
      const closestCluster = distances.indexOf(Math.min(...distances));
      clusters[closestCluster].push(feature);
    }

    // Update centroids
    const newCentroids = clusters.map(cluster => {
      if (cluster.length === 0) {
        // Keep old centroid if cluster is empty
        return centroids[clusters.indexOf(cluster)];
      }
      return {
        hdi: cluster.reduce((s, f) => s + f.hdi, 0) / cluster.length,
        escalation: cluster.reduce((s, f) => s + f.escalationRate, 0) / cluster.length,
        independence: cluster.reduce((s, f) => s + f.independence, 0) / cluster.length
      };
    });

    // Check for convergence
    const converged = centroids.every((c, i) => {
      const nc = newCentroids[i];
      return (
        Math.abs(c.hdi - nc.hdi) < 0.001 &&
        Math.abs(c.escalation - nc.escalation) < 0.001 &&
        Math.abs(c.independence - nc.independence) < 0.001
      );
    });

    centroids = newCentroids;
    iterations++;

    if (converged) break;
  }

  return clusters;
}

function labelCluster(cluster: LearnerFeatures[]): string {
  if (cluster.length === 0) return 'Empty Cluster';
  
  const avgHDI = cluster.reduce((s, f) => s + f.hdi, 0) / cluster.length;
  const avgEscalation = cluster.reduce((s, f) => s + f.escalationRate, 0) / cluster.length;
  
  if (avgHDI < 0.3 && avgEscalation < 0.3) return 'Independent Learners';
  if (avgHDI > 0.6 && avgEscalation > 0.6) return 'Hint-Dependent Learners';
  if (avgHDI > 0.4 && avgHDI < 0.7 && avgEscalation > 0.4) return 'Strategic Help-Seekers';
  if (avgHDI > 0.5 && avgEscalation < 0.4) return 'Self-Directed Learners';
  return 'Mixed Profile';
}

function describeCluster(cluster: LearnerFeatures[]): string[] {
  if (cluster.length === 0) return ['No members'];
  
  const traits: string[] = [];
  const avgHDI = cluster.reduce((s, f) => s + f.hdi, 0) / cluster.length;
  const avgEscalation = cluster.reduce((s, f) => s + f.escalationRate, 0) / cluster.length;
  const avgIndependence = cluster.reduce((s, f) => s + f.independence, 0) / cluster.length;
  const avgConceptCoverage = cluster.reduce((s, f) => s + f.conceptCoverage, 0) / cluster.length;
  
  if (avgHDI < 0.3) traits.push('High independence (low HDI)');
  else if (avgHDI > 0.6) traits.push('High dependency (high HDI)');
  else traits.push('Moderate HDI');
  
  if (avgEscalation > 0.5) traits.push('Frequent escalation');
  else if (avgEscalation < 0.2) traits.push('Stays at low rungs');
  else traits.push('Moderate escalation');
  
  if (avgIndependence > 0.7) traits.push('High success rate');
  else if (avgIndependence < 0.4) traits.push('Struggling with errors');
  
  if (avgConceptCoverage > 5) traits.push('Broad concept coverage');
  else if (avgConceptCoverage < 2) traits.push('Limited concept coverage');
  
  return traits;
}

function calculateCentroids(cluster: LearnerFeatures[]): {
  hdi: number;
  escalationRate: number;
  independence: number;
} {
  if (cluster.length === 0) {
    return { hdi: 0, escalationRate: 0, independence: 0 };
  }
  
  return {
    hdi: cluster.reduce((s, f) => s + f.hdi, 0) / cluster.length,
    escalationRate: cluster.reduce((s, f) => s + f.escalationRate, 0) / cluster.length,
    independence: cluster.reduce((s, f) => s + f.independence, 0) / cluster.length
  };
}

/**
 * Get cluster statistics for a specific learner
 */
export function getLearnerClusterInfo(
  learnerId: string,
  clusters: LearnerCluster[]
): LearnerCluster | undefined {
  return clusters.find(c => c.members.includes(learnerId));
}
