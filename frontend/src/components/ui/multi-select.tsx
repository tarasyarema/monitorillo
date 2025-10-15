import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';

interface MultiSelectProps {
  options: Map<string, { name: string; server: string }>;
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedKeys, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = Array.from(options.entries()).filter(([, container]) => {
    const searchText = filterText.toLowerCase();
    return container.name.toLowerCase().includes(searchText) || container.server.toLowerCase().includes(searchText);
  });

  const handleToggle = (key: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    onSelectionChange(new Set(options.keys()));
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
  };

  const handleSelectMatching = () => {
    const matchingKeys = filteredOptions.map(([key]) => key);
    onSelectionChange(new Set(matchingKeys));
  };

  const selectedCount = selectedKeys.size === 0 ? options.size : selectedKeys.size;
  const displayText =
    selectedKeys.size === 0
      ? `All containers (${options.size})`
      : `${selectedCount} container${selectedCount !== 1 ? 's' : ''} selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="outline" onClick={() => setIsOpen(!isOpen)} className="w-full justify-between">
        <span>{displayText}</span>
        <svg
          className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white border rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <Input
              placeholder="Filter containers..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="flex-1">
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll} className="flex-1">
                Deselect All
              </Button>
              {filterText && (
                <Button variant="outline" size="sm" onClick={handleSelectMatching} className="flex-1">
                  Select Matching
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(([key, container]) => {
                const isSelected = selectedKeys.size === 0 || selectedKeys.has(key);
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleToggle(key)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {container.server}
                      </Badge>
                      <span className="text-sm">{container.name}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">No containers match your filter</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
