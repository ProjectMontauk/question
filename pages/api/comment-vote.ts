import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.tinfoilnews.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { commentId, walletAddress, voteType } = req.body;
      
      if (!commentId || !walletAddress || !voteType) {
        return res.status(400).json({ error: 'Comment ID, wallet address, and vote type are required' });
      }
      
      if (!['upvote', 'downvote'].includes(voteType)) {
        return res.status(400).json({ error: 'Vote type must be either "upvote" or "downvote"' });
      }
      
      // Verify the comment exists
      const comment = await prisma.comment.findUnique({
        where: { id: parseInt(commentId) }
      });
      
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      // Check if user has already voted on this comment
      const existingVote = await prisma.commentVote.findUnique({
        where: {
          commentId_walletAddress: {
            commentId: parseInt(commentId),
            walletAddress
          }
        }
      });
      
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // User is removing their vote
          await prisma.commentVote.delete({
            where: { id: existingVote.id }
          });
          
          // Update comment vote counts
          const updatedComment = await prisma.comment.update({
            where: { id: parseInt(commentId) },
            data: {
              upvotes: voteType === 'upvote' ? { decrement: 1 } : undefined,
              downvotes: voteType === 'downvote' ? { decrement: 1 } : undefined
            }
          });
          
          return res.status(200).json({ 
            comment: updatedComment, 
            action: 'removed',
            voteType 
          });
        } else {
          // User is changing their vote (e.g., from upvote to downvote)
          await prisma.commentVote.update({
            where: { id: existingVote.id },
            data: { voteType }
          });
          
          // Update comment vote counts (decrement old vote, increment new vote)
          const updatedComment = await prisma.comment.update({
            where: { id: parseInt(commentId) },
            data: {
              upvotes: existingVote.voteType === 'upvote' ? { decrement: 1 } : { increment: 1 },
              downvotes: existingVote.voteType === 'downvote' ? { decrement: 1 } : { increment: 1 }
            }
          });
          
          return res.status(200).json({ 
            comment: updatedComment, 
            action: 'changed',
            voteType,
            previousVoteType: existingVote.voteType
          });
        }
      } else {
        // User is voting for the first time
        await prisma.commentVote.create({
          data: {
            commentId: parseInt(commentId),
            walletAddress,
            voteType,
            marketId: comment.marketId
          }
        });
        
        // Update comment vote counts
        const updatedComment = await prisma.comment.update({
          where: { id: parseInt(commentId) },
          data: {
            upvotes: voteType === 'upvote' ? { increment: 1 } : undefined,
            downvotes: voteType === 'downvote' ? { increment: 1 } : undefined
          }
        });
        
        return res.status(201).json({ 
          comment: updatedComment, 
          action: 'added',
          voteType
        });
      }
    } catch (error) {
      console.error('Comment vote error:', error);
      res.status(500).json({ error: 'Failed to process comment vote' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 