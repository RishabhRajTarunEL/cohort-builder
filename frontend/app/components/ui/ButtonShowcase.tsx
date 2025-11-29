import React from 'react';
import Button from './Button';
import IconButton from './IconButton';
import ButtonGroup from './ButtonGroup';
import SplitButton from './SplitButton';
import Tag from './Tag';
import { Plus, ChevronLeft, ChevronRight, Lock, ChevronDown, Loader2, Save, Copy, Download } from 'lucide-react';

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

      {/* Split Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Split Buttons</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <SplitButton
              variant="primary"
              icon={<Save />}
              onMainClick={() => console.log('Save clicked')}
              menuItems={[
                { label: 'Save as...', icon: <Copy />, onClick: () => console.log('Save as') },
                { label: 'Export', icon: <Download />, onClick: () => console.log('Export') },
              ]}
            >
              Save
            </SplitButton>

            <SplitButton
              variant="secondary"
              onMainClick={() => console.log('Export clicked')}
              menuItems={[
                { label: 'Export as PDF', onClick: () => console.log('PDF') },
                { label: 'Export as CSV', onClick: () => console.log('CSV') },
                { label: 'Export as JSON', onClick: () => console.log('JSON') },
              ]}
            >
              Export
            </SplitButton>

            <SplitButton
              variant="accent"
              onMainClick={() => console.log('Action clicked')}
              menuItems={[
                { label: 'Option 1', onClick: () => console.log('Option 1') },
                { label: 'Option 2', onClick: () => console.log('Option 2') },
                { label: 'Option 3', disabled: true, onClick: () => console.log('Option 3') },
              ]}
            >
              Actions
            </SplitButton>

            <SplitButton
              variant="primary"
              disabled
              onMainClick={() => console.log('Disabled')}
              menuItems={[
                { label: 'Option 1', onClick: () => console.log('Option 1') },
              ]}
            >
              Disabled
            </SplitButton>

            <SplitButton
              variant="primary"
              loading
              onMainClick={() => console.log('Loading')}
              menuItems={[
                { label: 'Option 1', onClick: () => console.log('Option 1') },
              ]}
            >
              Loading
            </SplitButton>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tags</h2>
        
        {/* Dark Style Tags - Clinical Palette */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Dark Style</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Tag variant="blue" style="dark">Blue (Primary)</Tag>
            <Tag variant="teal" style="dark">Teal (Data)</Tag>
            <Tag variant="yellow" style="dark">Amber (Warning)</Tag>
            <Tag variant="orange" style="dark">Coral (Exclude)</Tag>
            <Tag variant="gray" style="dark">Slate (Neutral)</Tag>
            <Tag variant="red" style="dark">Red (Error)</Tag>
          </div>
        </div>

        {/* Light Style Tags - Clinical Palette */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Light Style</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Tag variant="blue" style="light">Blue (Primary)</Tag>
            <Tag variant="teal" style="light">Teal (Data)</Tag>
            <Tag variant="yellow" style="light">Amber (Warning)</Tag>
            <Tag variant="orange" style="light">Coral (Exclude)</Tag>
            <Tag variant="gray" style="light">Slate (Neutral)</Tag>
            <Tag variant="red" style="light">Red (Error)</Tag>
          </div>
        </div>

        {/* Tags with Close Button */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">With Close Button</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Tag variant="blue" style="dark" onClose={() => console.log('Remove blue')}>
              Removable
            </Tag>
            <Tag variant="orange" style="light" onClose={() => console.log('Remove coral')}>
              Removable
            </Tag>
            <Tag variant="teal" style="dark" onClose={() => console.log('Remove teal')}>
              Removable
            </Tag>
            <Tag variant="gray" style="light" onClose={() => console.log('Remove slate')}>
              Removable
            </Tag>
          </div>
        </div>

        {/* Tag Sizes */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Sizes</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Tag variant="blue" style="dark" size="sm">Small</Tag>
            <Tag variant="blue" style="dark" size="md">Medium</Tag>
            <Tag variant="blue" style="dark" size="lg">Large</Tag>
          </div>
        </div>

        {/* Use Cases - Clinical Context */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-3">Use Cases</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Status:</span>
              <Tag variant="teal" style="light">Active</Tag>
              <Tag variant="yellow" style="light">Pending</Tag>
              <Tag variant="orange" style="light">Failed</Tag>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Categories:</span>
              <Tag variant="blue" style="dark" onClose={() => {}}>Clinical Trial</Tag>
              <Tag variant="teal" style="dark" onClose={() => {}}>Data Analysis</Tag>
              <Tag variant="gray" style="dark" onClose={() => {}}>Research</Tag>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Filters:</span>
              <Tag variant="blue" style="light" size="sm" onClose={() => {}}>Age: 18-65</Tag>
              <Tag variant="blue" style="light" size="sm" onClose={() => {}}>Gender: All</Tag>
              <Tag variant="teal" style="light" size="sm" onClose={() => {}}>Cohort Size: 150</Tag>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ButtonShowcase;
