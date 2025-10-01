import type { HighlightEntry } from '../EpubPluginSettings';

/**
 * Spatial index for highlights organized by EPUB section
 * Provides O(1) lookup by section instead of O(n) linear scan
 * 
 * Performance improvement:
 * - Before: O(n) where n = total highlights in book
 * - After: O(k) where k = highlights in current section (~10-20)
 * - Speedup: ~10-50x for books with many highlights
 */
export class HighlightIndex {
  private bySection: Map<string, HighlightEntry[]> = new Map();
  
  constructor(highlights: HighlightEntry[]) {
    this.rebuild(highlights);
  }
  
  /**
   * Rebuilds the entire index from scratch
   * Call this when highlights array is replaced entirely
   */
  rebuild(highlights: HighlightEntry[]) {
    this.bySection.clear();
    
    highlights.forEach(h => {
      const sectionId = this.extractSectionId(h.cfi);
      if (!sectionId) return;
      
      if (!this.bySection.has(sectionId)) {
        this.bySection.set(sectionId, []);
      }
      const list = this.bySection.get(sectionId);
      if (list) list.push(h);
    });
  }
  
  /**
   * Gets all highlights for a specific section
   * This is the main performance optimization - O(1) lookup
   * 
   * @param sectionCfi - CFI of the current section/location
   * @returns Array of highlights in that section
   */
  getForSection(sectionCfi: string): HighlightEntry[] {
    const sectionId = this.extractSectionId(sectionCfi);
    return sectionId ? (this.bySection.get(sectionId) || []) : [];
  }
  
  /**
   * Gets all highlights across all sections
   */
  getAll(): HighlightEntry[] {
    const all: HighlightEntry[] = [];
    this.bySection.forEach(highlights => all.push(...highlights));
    return all;
  }
  
  /**
   * Adds a new highlight to the index
   * Incremental operation - no need to rebuild entire index
   */
  add(highlight: HighlightEntry) {
    const sectionId = this.extractSectionId(highlight.cfi);
    if (!sectionId) return;
    
    if (!this.bySection.has(sectionId)) {
      this.bySection.set(sectionId, []);
    }
    const list = this.bySection.get(sectionId);
    if (list) list.push(highlight);
  }
  
  /**
   * Removes a highlight from the index by CFI
   * Incremental operation - no need to rebuild entire index
   */
  remove(cfi: string) {
    const sectionId = this.extractSectionId(cfi);
    if (!sectionId) return;
    
    const list = this.bySection.get(sectionId);
    if (!list) return;
    
    const index = list.findIndex(h => h.cfi === cfi);
    if (index !== -1) {
      list.splice(index, 1);
      
      // Clean up empty sections
      if (list.length === 0) {
        this.bySection.delete(sectionId);
      }
    }
  }
  
  /**
   * Updates a highlight in place
   * Finds by CFI and replaces the entry
   */
  update(cfi: string, updatedHighlight: HighlightEntry) {
    const sectionId = this.extractSectionId(cfi);
    if (!sectionId) return;
    
    const list = this.bySection.get(sectionId);
    if (!list) return;
    
    const index = list.findIndex(h => h.cfi === cfi);
    if (index !== -1) {
      list[index] = updatedHighlight;
    }
  }
  
  /**
   * Finds a highlight by its CFI
   */
  findByCfi(cfi: string): HighlightEntry | undefined {
    const sectionId = this.extractSectionId(cfi);
    if (!sectionId) return undefined;
    
    const list = this.bySection.get(sectionId);
    return list?.find(h => h.cfi === cfi);
  }
  
  /**
   * Extracts the section identifier from a CFI
   * 
   * CFI format: epubcfi(/6/8!/4/2[chapter.html]/2/8,/1:0,/2:5)
   * Section ID: "/6/8" (the spine item path before the "!")
   * 
   * This groups highlights by chapter/section for efficient lookup
   */
  private extractSectionId(cfi: string): string | null {
    // Match the section part: /6/8 from epubcfi(/6/8!/...)
    const match = cfi.match(/^epubcfi\((\/\d+(?:\/\d+)*)/);
    return match ? match[1] : null;
  }
  
  /**
   * Gets statistics about the index
   * Useful for debugging and monitoring performance
   */
  getStats() {
    const sectionCount = this.bySection.size;
    const totalHighlights = this.getAll().length;
    const avgPerSection = sectionCount > 0 ? totalHighlights / sectionCount : 0;
    
    return {
      sectionCount,
      totalHighlights,
      avgPerSection: Math.round(avgPerSection * 10) / 10,
    };
  }
}
