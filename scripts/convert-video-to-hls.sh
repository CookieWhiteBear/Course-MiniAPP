#!/bin/bash

# Video to HLS Converter with Multiple Bitrates
# Usage: ./convert-video-to-hls.sh input.mp4 output_directory

if [ $# -lt 2 ]; then
    echo "Usage: $0 <input_video> <output_directory>"
    echo "Example: $0 lesson1.mp4 ./public/videos/lesson1"
    exit 1
fi

INPUT_VIDEO="$1"
OUTPUT_DIR="$2"

# Check if input file exists
if [ ! -f "$INPUT_VIDEO" ]; then
    echo "Error: Input file '$INPUT_VIDEO' not found"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Converting $INPUT_VIDEO to HLS format..."
echo "Output directory: $OUTPUT_DIR"

# Convert video to HLS with multiple quality levels
# This creates 3 versions: 360p, 720p, 1080p with adaptive bitrate

ffmpeg -i "$INPUT_VIDEO" \
  -filter_complex \
  "[0:v]split=3[v1][v2][v3]; \
   [v1]scale=w=640:h=360[v1out]; \
   [v2]scale=w=1280:h=720[v2out]; \
   [v3]scale=w=1920:h=1080[v3out]" \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 800k -maxrate 856k -bufsize 1200k -preset fast \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 2800k -maxrate 2996k -bufsize 4200k -preset fast \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 5000k -maxrate 5350k -bufsize 7500k -preset fast \
  -map a:0 -map a:0 -map a:0 -c:a aac -b:a 128k -ac 2 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "$OUTPUT_DIR/stream_%v/segment_%03d.ts" \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  "$OUTPUT_DIR/stream_%v.m3u8"

echo "Conversion complete!"
echo "Master playlist: $OUTPUT_DIR/master.m3u8"
echo ""
echo "Quality levels:"
echo "  - 360p (800 kbps): $OUTPUT_DIR/stream_0.m3u8"
echo "  - 720p (2800 kbps): $OUTPUT_DIR/stream_1.m3u8"
echo "  - 1080p (5000 kbps): $OUTPUT_DIR/stream_2.m3u8"
echo ""
echo "To use in your app, reference: /videos/$(basename $OUTPUT_DIR)/master.m3u8"
