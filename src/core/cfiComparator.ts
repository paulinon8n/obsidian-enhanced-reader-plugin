import type { HighlightEntry } from '../EpubPluginSettings';

/**
 * CFI (Canonical Fragment Identifier) comparison utilities
 * 
 * Replaces naive string matching with proper CFI-aware comparison.
 * This prevents false positives where substring matching would incorrectly
 * identify overlapping highlights.
 * 
 * Example problem with old approach:
 *   cfi1 = "epubcfi(/6/8!/4/2,/1:0,/1:10)"
 *   cfi2 = "epubcfi(/6/8!/4/2,/1:5,/1:15)"
 *   
 *   Old: cfi1.includes(cfi2) = false (incorrect!)
 *   New: overlaps(cfi1, cfi2) = true (correct!)
 */
export class CfiComparator {
  /**
   * Checks if two CFI ranges overlap
   * 
   * Two ranges overlap if they share any text portion, even partially.
   * This is the primary method for detecting if a selection intersects
   * an existing highlight.
   * 
   * @param cfi1 - First CFI range
   * @param cfi2 - Second CFI range
   * @returns true if ranges overlap
   */
  static overlaps(cfi1: string, cfi2: string): boolean {
    // Fast path: exact match
    if (cfi1 === cfi2) return true;
    
    try {
      const parsed1 = this.parseCfi(cfi1);
      const parsed2 = this.parseCfi(cfi2);
      
      // Must be in same section to overlap
      if (parsed1.section !== parsed2.section) return false;
      
      // Check if ranges overlap using start/end positions
      // Range A overlaps Range B if: A.start < B.end AND A.end > B.start
      return parsed1.start < parsed2.end && parsed1.end > parsed2.start;
    } catch (error) {
      // Fallback to string equality if parsing fails
      return cfi1 === cfi2;
    }
  }
  
  /**
   * Checks if cfi1 completely contains cfi2
   * 
   * Container contains contained if the contained range is entirely
   * within the container range.
   * 
   * @param container - Outer CFI range
   * @param contained - Inner CFI range
   * @returns true if container fully contains contained
   */
  static contains(container: string, contained: string): boolean {
    if (container === contained) return true;
    
    try {
      const parsedContainer = this.parseCfi(container);
      const parsedContained = this.parseCfi(contained);
      
      // Must be in same section
      if (parsedContainer.section !== parsedContained.section) return false;
      
      // Container must start before or at contained start
      // AND end after or at contained end
      return (
        parsedContainer.start <= parsedContained.start &&
        parsedContainer.end >= parsedContained.end
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Finds all highlights that overlap with a given CFI selection
   * 
   * This is more robust than the old approach which used string.includes()
   * and could produce false positives.
   * 
   * @param selectionCfi - The selected text's CFI
   * @param highlights - Array of existing highlights
   * @returns Array of overlapping highlights
   */
  static findOverlapping(
    selectionCfi: string, 
    highlights: HighlightEntry[]
  ): HighlightEntry[] {
    return highlights.filter(h => 
      h.cfi && this.overlaps(selectionCfi, h.cfi)
    );
  }
  
  /**
   * Parses a CFI string into comparable components
   * 
   * CFI format: epubcfi(/6/8!/4/2[chapter.html]/2/8,/1:0,/2:5)
   * 
   * Components:
   * - section: "/6/8" (spine item)
   * - path: "/4/2[chapter.html]/2/8" (element path)
   * - start: Position of range start (character offset)
   * - end: Position of range end (character offset)
   * 
   * @private
   */
  private static parseCfi(cfi: string): {
    section: string;
    path: string;
    start: number;
    end: number;
  } {
    // Remove "epubcfi(" prefix and ")" suffix
    const cleaned = cfi.replace(/^epubcfi\(/, '').replace(/\)$/, '');
    
    // Split by "!" to separate spine from content
    const [section, rest] = cleaned.split('!');
    
    if (!rest) {
      // Simple CFI without range (just a point)
      return {
        section: section || '',
        path: '',
        start: 0,
        end: 0,
      };
    }
    
    // Split by "," to separate path from range
    const parts = rest.split(',');
    const path = parts[0] || '';
    
    // Parse range if present
    let start = 0;
    let end = 0;
    
    if (parts.length >= 3) {
      // Range format: /path,/startNode:startOffset,/endNode:endOffset
      const startPart = parts[1];
      const endPart = parts[2];
      
      start = this.extractOffset(startPart);
      end = this.extractOffset(endPart);
    } else if (parts.length === 2) {
      // Single point: /path,/node:offset
      start = this.extractOffset(parts[1]);
      end = start;
    }
    
    return { section, path, start, end };
  }
  
  /**
   * Extracts character offset from a CFI position component
   * 
   * Example: "/1:5" -> 5 (offset 5 in node 1)
   * 
   * For simplicity, we use a combined node+offset as a single number.
   * Node numbers are multiplied by 10000 to create distinct ranges.
   * 
   * @private
   */
  private static extractOffset(positionStr: string): number {
    // Remove leading "/"
    const cleaned = positionStr.replace(/^\//, '');
    
    // Split by ":" to get node and offset
    const [nodeStr, offsetStr] = cleaned.split(':');
    
    const node = parseInt(nodeStr, 10) || 0;
    const offset = parseInt(offsetStr, 10) || 0;
    
    // Combine into single number: node * 10000 + offset
    // This assumes nodes don't have more than 10000 characters (reasonable for HTML)
    return node * 10000 + offset;
  }
  
  /**
   * Validates if a CFI string is well-formed
   * 
   * Basic checks:
   * - Starts with "epubcfi("
   * - Contains section path (/digits/digits)
   * - Has proper structure
   * 
   * @param cfi - CFI string to validate
   * @returns true if valid
   */
  static isValid(cfi: string): boolean {
    if (!cfi || typeof cfi !== 'string') return false;
    if (!cfi.startsWith('epubcfi(')) return false;
    if (!cfi.endsWith(')')) return false;
    
    // Check for basic structure: at least /digit
    const match = cfi.match(/epubcfi\((\/\d+)/);
    return match !== null;
  }
}
