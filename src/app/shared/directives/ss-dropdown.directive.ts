import {
  AfterViewInit,
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';

@Directive({
  selector: '.ss__dropdown',
  standalone: true,
})
export class SsDropdownDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly zone = inject(NgZone);

  private trigger: HTMLElement | null = null;
  private rafId = 0;
  private readonly onUpdate = () => this.schedule();

  ngAfterViewInit(): void {
    const container = this.host.closest('.ss') as HTMLElement | null;
    if (!container) return;
    this.trigger = container.querySelector('.ss__trigger');
    if (!this.trigger) return;

    this.zone.runOutsideAngular(() => {
      this.position();
      window.addEventListener('resize', this.onUpdate, { passive: true });
      // Capture-phase scroll catches scroll on ANY ancestor without
      // having to enumerate scroll parents (scroll doesn't bubble).
      window.addEventListener('scroll', this.onUpdate, { passive: true, capture: true });
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onUpdate);
    window.removeEventListener('scroll', this.onUpdate, true);
  }

  private schedule(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.position());
  }

  private position(): void {
    if (!this.trigger) return;
    const rect = this.trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    this.host.style.position = 'fixed';
    this.host.style.zIndex = '10000';
    this.host.style.width = `${rect.width}px`;

    const panelH = this.host.offsetHeight;
    const gap = 4;
    const spaceBelow = viewportH - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const flipUp = spaceBelow < Math.min(panelH, 220) && spaceAbove > spaceBelow;

    const top = flipUp
      ? Math.max(8, rect.top - panelH - gap)
      : rect.bottom + gap;

    let left = rect.left;
    if (left + rect.width > viewportW - 8) left = viewportW - rect.width - 8;
    if (left < 8) left = 8;

    this.host.style.top = `${top}px`;
    this.host.style.left = `${left}px`;
    this.host.style.right = 'auto';
    this.host.style.bottom = 'auto';
    this.host.style.insetInlineStart = 'auto';
    this.host.style.insetInlineEnd = 'auto';
  }
}
