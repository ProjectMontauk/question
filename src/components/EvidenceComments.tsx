import React, { useState, useEffect, useRef, useCallback } from 'react';
import Comment from './Comment';

// Backend API base URL - use Next.js API routes for both dev and production
const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://tacoshell.vercel.app' : '';

interface Evidence {
  id: number;
  type: 'yes' | 'no';
  title: string;
  url?: string;
  description: string;
  netVotes: number;
  walletAddress: string;
  createdAt?: string;
  commentCount: number;
}

interface CommentData {
  id: number;
  content: string;
  walletAddress: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote?: string | null;
  replies: CommentData[];
}

interface EvidenceCommentsProps {
  evidence: Evidence;
  currentUserAddress?: string;
}

const EvidenceComments: React.FC<EvidenceCommentsProps> = ({
  evidence,
  currentUserAddress
}) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    if (!evidence) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        evidenceId: evidence.id.toString()
      });
      if (currentUserAddress) {
        params.append('walletAddress', currentUserAddress);
      }
      const response = await fetch(`${API_BASE_URL}/api/comments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [evidence, currentUserAddress]);

  // Fetch comments on mount and when evidence changes
  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line
  }, [evidence]);

  // Auto-expand textarea as user types
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = '2.5rem'; // Reset to min height
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !evidence || !currentUserAddress) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: evidence.id,
          content: newComment,
          walletAddress: currentUserAddress
        })
      });
      if (response.ok) {
        setNewComment('');
        await fetchComments();
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: number, content: string) => {
    if (!evidence || !currentUserAddress) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: evidence.id,
          parentId,
          content,
          walletAddress: currentUserAddress
        })
      });
      if (response.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
      throw error;
    }
  };

  const handleVote = async (commentId: number, voteType: 'upvote' | 'downvote') => {
    if (!currentUserAddress) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/comment-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          walletAddress: currentUserAddress,
          voteType
        })
      });
      if (response.ok) {
        // Optimistically update the comment in the local state
        const updateCommentVotes = (comments: CommentData[]): CommentData[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              const updatedComment = { ...comment };
              if (comment.userVote === voteType) {
                // Removing vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = Math.max(0, comment.upvotes - 1);
                } else {
                  updatedComment.downvotes = Math.max(0, comment.downvotes - 1);
                }
                updatedComment.userVote = null;
              } else if (comment.userVote && comment.userVote !== voteType) {
                // Changing vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = comment.upvotes + 1;
                  updatedComment.downvotes = Math.max(0, comment.downvotes - 1);
                } else {
                  updatedComment.downvotes = comment.downvotes + 1;
                  updatedComment.upvotes = Math.max(0, comment.upvotes - 1);
                }
                updatedComment.userVote = voteType;
              } else {
                // Adding new vote
                if (voteType === 'upvote') {
                  updatedComment.upvotes = comment.upvotes + 1;
                } else {
                  updatedComment.downvotes = comment.downvotes + 1;
                }
                updatedComment.userVote = voteType;
              }
              return updatedComment;
            }
            return {
              ...comment,
              replies: updateCommentVotes(comment.replies)
            };
          });
        };
        setComments(updateCommentVotes);
      }
    } catch (error) {
      console.error('Failed to vote on comment:', error);
      throw error;
    }
  };

  return (
    <div className="bg-white rounded-xl mt-4">
      <div className="pb-4 bg-white">
        {/* New comment form */}
        {currentUserAddress && (
          <form onSubmit={handleSubmitComment} className="mb-4">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleTextareaInput}
              placeholder="Add a comment..."
              className="w-full p-[5px] border border-gray-300 rounded-lg resize-none bg-white text-gray-900 min-h-[2.25rem] text-[15.2px]"
              rows={1}
              style={{overflow: 'hidden'}}
              disabled={isSubmitting}
            />
            <div className="flex justify-end mt-2">
              {newComment.trim().length > 0 && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </button>
              )}
            </div>
          </form>
        )}
        {/* Comments section */}
        <div className="bg-white">
          <h3 className="text-[15.2px] font-semibold text-gray-900 mb-4">Replies</h3>
          {isLoading ? (
            <div className="text-center py-8 bg-white">
              <div className="text-gray-500">Loading comments...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 bg-white">
              <div className="text-gray-500">No comments yet. Be the first to comment!</div>
            </div>
          ) : (
            <div className="space-y-4 bg-white">
              {comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  evidenceId={evidence.id}
                  currentUserAddress={currentUserAddress}
                  onReply={handleReply}
                  onVote={handleVote}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvidenceComments; 