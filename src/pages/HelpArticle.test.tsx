import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import HelpArticle from './HelpArticle';

describe('HelpArticle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the help article content and feedback component', () => {
    render(<HelpArticle />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Getting Started with Veritasor');
    expect(screen.getByText('Last updated: July 2026')).toBeInTheDocument();
    
    // Check main sections
    expect(screen.getByRole('heading', { level: 2, name: '1. Create a workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2. Add an attestation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '3. Verify and share' })).toBeInTheDocument();

    // Check feedback component is rendered
    expect(screen.getByRole('heading', { name: 'Was this helpful?' })).toBeInTheDocument();
  });

  it('handles feedback submission (success state transition)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HelpArticle />);
    
    const helpfulBtn = screen.getByRole('button', { name: 'This article was helpful' });
    await user.click(helpfulBtn);

    const submitBtn = screen.getByRole('button', { name: 'Submit feedback' });
    await user.click(submitBtn);

    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument();
  });

  it('handles negative feedback with a valid comment', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HelpArticle />);
    
    const notHelpfulBtn = screen.getByRole('button', { name: 'This article was not helpful' });
    await user.click(notHelpfulBtn);

    const commentBox = screen.getByRole('textbox', { name: /Any additional thoughts\?/i });
    expect(commentBox).toBeInTheDocument();

    await user.type(commentBox, 'This is missing some details.');

    const submitBtn = screen.getByRole('button', { name: 'Submit feedback' });
    await user.click(submitBtn);

    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument();
  });

  it('handles invalid input: comment exceeds 500 characters', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HelpArticle />);
    
    const notHelpfulBtn = screen.getByRole('button', { name: 'This article was not helpful' });
    await user.click(notHelpfulBtn);

    const commentBox = screen.getByRole('textbox', { name: /Any additional thoughts\?/i });
    
    // Typing 501 characters could be slow with userEvent.type, so we can paste it instead
    const longText = 'a'.repeat(501);
    await user.click(commentBox);
    await user.paste(longText);

    const submitBtn = screen.getByRole('button', { name: 'Submit feedback' });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent('Comment must be 500 characters or fewer.');
    expect(screen.queryByText('Thanks for your feedback!')).not.toBeInTheDocument();
  });

  it('handles invalid input: rate limiting on submissions', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<HelpArticle />);
    
    // First submission
    const helpfulBtn = screen.getByRole('button', { name: 'This article was helpful' });
    await user.click(helpfulBtn);
    let submitBtn = screen.getByRole('button', { name: 'Submit feedback' });
    await user.click(submitBtn);
    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument();

    // Reset feedback
    const resetBtn = screen.getByRole('button', { name: 'Submit different feedback' });
    await user.click(resetBtn);

    // Try submitting again immediately
    const notHelpfulBtn = screen.getByRole('button', { name: 'This article was not helpful' });
    await user.click(notHelpfulBtn);
    submitBtn = screen.getByRole('button', { name: 'Submit feedback' });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent('Please wait before submitting another response.');
  });
});
