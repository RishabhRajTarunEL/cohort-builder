import React from 'react';
import Button from './Button';
import IconButton from './IconButton';
import ButtonGroup from './ButtonGroup';
import { Plus, ChevronLeft, ChevronRight, Lock, ChevronDown, Loader2 } from 'lucide-react';

/**
 * ButtonShowcase - Demonstrates all button variants and states
 * Based on the design system shown in the reference image
 */
const ButtonShowcase: React.FC = () => {
  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Button Design System</h1>
        <p className="text-gray-600">Complete button component library with variants, sizes, and states</p>
      </div>

      {/* Primary Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Primary</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Default</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" disabled>Split Disabled</Button>
            <Button variant="primary" icon={<ChevronDown />} iconPosition="right">Dropdown</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="primary">Untitled</Button>
            <Button variant="primary" icon={<Plus />} iconPosition="left">Untitled</Button>
            <Button variant="primary" icon={<ChevronLeft />} iconPosition="left">Untitled</Button>
            <IconButton variant="primary" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="primary" icon={<ChevronDown />} iconPosition="right">Untitled</Button>
            <Button variant="primary" icon={<Lock />} iconPosition="left">Untitled</Button>
            <IconButton variant="primary" icon={<Plus />} aria-label="Add" />
            <IconButton variant="primary" icon={<ChevronDown />} aria-label="More options" />
          </div>
        </div>
      </section>

      {/* Secondary Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Secondary</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="secondary">Default</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <Button variant="secondary" disabled>Split Disabled</Button>
            <Button variant="secondary" icon={<ChevronDown />} iconPosition="right">Dropdown</Button>
            <Button variant="secondary" loading>Loading</Button>
            <Button variant="secondary">Untitled</Button>
            <Button variant="secondary" icon={<Plus />} iconPosition="left">Untitled</Button>
            <Button variant="secondary" icon={<ChevronLeft />} iconPosition="left">Untitled</Button>
            <IconButton variant="secondary" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="secondary" icon={<ChevronDown />} iconPosition="right">Untitled</Button>
            <Button variant="secondary" icon={<Lock />} iconPosition="left">Untitled</Button>
            <IconButton variant="secondary" icon={<Plus />} aria-label="Add" />
            <IconButton variant="secondary" icon={<ChevronDown />} aria-label="More options" />
          </div>
        </div>
      </section>

      {/* Tertiary Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tertiary</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="tertiary">Default</Button>
            <Button variant="tertiary" disabled>Disabled</Button>
            <Button variant="tertiary" disabled>Split Disabled</Button>
            <Button variant="tertiary" icon={<ChevronDown />} iconPosition="right">Dropdown</Button>
            <Button variant="tertiary" loading>Loading</Button>
            <Button variant="tertiary">Untitled</Button>
            <Button variant="tertiary" icon={<Plus />} iconPosition="left">Untitled</Button>
            <Button variant="tertiary" icon={<ChevronLeft />} iconPosition="left">Untitled</Button>
            <IconButton variant="tertiary" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="tertiary" icon={<ChevronDown />} iconPosition="right">Untitled</Button>
            <Button variant="tertiary" icon={<Lock />} iconPosition="left">Untitled</Button>
            <IconButton variant="tertiary" icon={<Plus />} aria-label="Add" />
            <IconButton variant="tertiary" icon={<ChevronDown />} aria-label="More options" />
          </div>
        </div>
      </section>

      {/* Tonal Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tonal</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="tonal">Default</Button>
            <Button variant="tonal" disabled>Disabled</Button>
            <Button variant="tonal" disabled>Split Disabled</Button>
            <Button variant="tonal" icon={<ChevronDown />} iconPosition="right">Dropdown</Button>
            <Button variant="tonal" loading>Loading</Button>
            <Button variant="tonal">Untitled</Button>
            <Button variant="tonal" icon={<Plus />} iconPosition="left">Untitled</Button>
            <Button variant="tonal" icon={<ChevronLeft />} iconPosition="left">Untitled</Button>
            <IconButton variant="tonal" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="tonal" icon={<ChevronDown />} iconPosition="right">Untitled</Button>
            <Button variant="tonal" icon={<Lock />} iconPosition="left">Untitled</Button>
            <IconButton variant="tonal" icon={<Plus />} aria-label="Add" />
            <IconButton variant="tonal" icon={<ChevronDown />} aria-label="More options" />
          </div>
        </div>
      </section>

      {/* Elevated Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Elevated</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="elevated">Default</Button>
            <Button variant="elevated" disabled>Disabled</Button>
            <Button variant="elevated" disabled>Split Disabled</Button>
            <Button variant="elevated" icon={<ChevronDown />} iconPosition="right">Dropdown</Button>
            <Button variant="elevated" loading>Loading</Button>
            <Button variant="elevated">Untitled</Button>
            <Button variant="elevated" icon={<Plus />} iconPosition="left">Untitled</Button>
            <Button variant="elevated" icon={<ChevronLeft />} iconPosition="left">Untitled</Button>
            <IconButton variant="elevated" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="elevated" icon={<ChevronDown />} iconPosition="right">Untitled</Button>
            <Button variant="elevated" icon={<Lock />} iconPosition="left">Untitled</Button>
            <IconButton variant="elevated" icon={<Plus />} aria-label="Add" />
            <IconButton variant="elevated" icon={<ChevronDown />} aria-label="More options" />
          </div>
        </div>
      </section>

      {/* Button Sizes */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Sizes</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <IconButton variant="primary" size="sm" icon={<Plus />} aria-label="Add small" />
            <IconButton variant="primary" size="md" icon={<Plus />} aria-label="Add medium" />
            <IconButton variant="primary" size="lg" icon={<Plus />} aria-label="Add large" />
          </div>
        </div>
      </section>

      {/* Button Groups */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Button Groups</h2>
        <div className="space-y-4">
          <ButtonGroup>
            <Button variant="secondary">Left</Button>
            <Button variant="secondary">Middle</Button>
            <Button variant="secondary">Right</Button>
          </ButtonGroup>
          
          <ButtonGroup>
            <IconButton variant="secondary" icon={<ChevronLeft />} aria-label="Previous" />
            <Button variant="secondary">Page 1 of 10</Button>
            <IconButton variant="secondary" icon={<ChevronRight />} aria-label="Next" />
          </ButtonGroup>
        </div>
      </section>

      {/* Full Width */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Full Width</h2>
        <div className="space-y-3 max-w-md">
          <Button variant="primary" fullWidth>Full Width Primary</Button>
          <Button variant="secondary" fullWidth>Full Width Secondary</Button>
          <Button variant="primary" fullWidth loading>Processing...</Button>
        </div>
      </section>
    </div>
  );
};

export default ButtonShowcase;
