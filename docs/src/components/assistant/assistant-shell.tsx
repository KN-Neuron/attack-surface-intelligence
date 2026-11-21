'use client';
import * as React from 'react';
import { useAssistant } from './assistant-provider';
import { AssistantPanel } from './assistant-panel';

/** Rząd „menu + treść + panel asystenta”. `data-assistant` pozwala stronom reagować na otwarty panel (np. ukryć spis treści). */
export function AssistantShell({ children }: { children: React.ReactNode }) {
    const { open } = useAssistant();
    return (
        <div className="group/shell flex" data-assistant={open ? 'open' : 'closed'}>
            {children}
            <AssistantPanel />
        </div>
    );
}
