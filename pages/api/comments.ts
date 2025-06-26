import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { evidenceId, walletAddress } = req.query;
      
      if (!evidenceId || typeof evidenceId !== 'string') {
        return res.status(400).json({ error: 'Evidence ID is required' });
      }
      
      // Fetch all comments for this evidence, including nested replies and vote counts
      const comments = await prisma.comment.findMany({
        where: { 
          evidenceId: parseInt(evidenceId),
          parentId: null // Only top-level comments
        },
        include: {
          replies: {
            include: {
              replies: {
                include: {
                  replies: true // Support up to 3 levels of nesting
                }
              }
            }
          },
          votes: walletAddress ? {
            where: {
              walletAddress: walletAddress as string
            }
          } : false
        },
        orderBy: [
          {
            upvotes: 'desc' // Sort by most upvoted first
          },
          {
            createdAt: 'desc' // Then by newest
          }
        ]
      });
      
      // Process comments to add user vote information
      const processedComments = comments.map(comment => ({
        ...comment,
        userVote: comment.votes?.[0]?.voteType || null,
        votes: undefined // Remove votes array from response
      }));
      
      res.status(200).json(processedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  } else if (req.method === 'POST') {
    try {
      const { evidenceId, parentId, content, walletAddress } = req.body;
      
      if (!evidenceId || !content || !walletAddress) {
        return res.status(400).json({ error: 'Evidence ID, content, and wallet address are required' });
      }
      
      // Verify the evidence exists
      const evidence = await prisma.evidence.findUnique({
        where: { id: parseInt(evidenceId) }
      });
      
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      
      // If this is a reply, verify the parent comment exists
      if (parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parseInt(parentId) }
        });
        
        if (!parentComment) {
          return res.status(404).json({ error: 'Parent comment not found' });
        }
      }
      
      // Create the comment
      const comment = await prisma.comment.create({
        data: {
          evidenceId: parseInt(evidenceId),
          parentId: parentId ? parseInt(parentId) : null,
          walletAddress,
          content
        },
        include: {
          replies: true
        }
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  } else {
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 