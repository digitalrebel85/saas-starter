'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; 
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { Upload, FileText, Check } from 'lucide-react';

export function LeadUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    
    try {
      setUploading(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload to your API
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      
      toast({
        title: 'Leads uploaded successfully',
        description: `${data.processedCount} leads have been uploaded and will be qualified automatically.`
      });
      
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }
  
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Input 
          type="file" 
          accept=".csv,.xlsx"
          id="file-upload"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-6 w-6 text-blue-500" />
              <span>{file.name}</span>
              <Check className="h-4 w-4 text-green-500" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="h-10 w-10 text-gray-400" />
              <span>Drop CSV or Excel file here, or click to browse</span>
            </div>
          )}
        </label>
      </div>
      
      {uploading && <Progress value={progress} />}
      
      <Button 
        type="submit" 
        disabled={!file || uploading}
        className="w-full"
      >
        {uploading ? 'Uploading...' : 'Upload and Qualify Leads'}
      </Button>
    </form>
  );
}