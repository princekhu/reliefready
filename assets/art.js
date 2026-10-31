/* ReliefReady illustrations: vector scenes drawn in code, sharp on any screen and with nothing to download.
   RR.art(name) returns an <svg>; RR.heroBanner(page) returns the banner used at the top of each dashboard. */
(function(){
if(!window.RR) return;
const INDIA = {"outline":"M256.8,144.6 258.1,143.8 261.8,144.7 266.0,146.4 266.9,143.6 268.3,139.4 270.8,136.4 271.0,132.5 271.2,128.9 273.4,127.3 274.7,124.0 275.8,119.0 276.9,115.4 279.7,113.8 281.5,113.0 284.9,109.9 290.9,107.8 296.5,110.3 293.5,105.0 297.5,102.0 298.7,98.5 291.5,95.9 287.9,96.7 288.1,95.3 290.6,93.0 290.0,90.3 285.7,84.9 277.3,89.4 271.3,86.3 266.3,89.5 264.0,93.1 257.7,93.9 256.5,97.2 252.2,98.7 251.5,101.1 248.8,102.9 242.8,104.0 244.2,106.5 245.2,113.1 241.0,114.0 233.4,114.3 227.2,113.4 222.2,115.2 217.3,113.5 214.5,113.6 212.2,112.2 210.7,110.3 211.4,107.3 211.9,101.0 209.7,99.8 205.4,101.6 204.5,105.1 203.8,109.5 205.3,114.4 204.5,116.8 199.9,118.7 194.8,118.5 193.6,116.7 190.4,118.1 183.4,115.5 181.2,116.3 180.3,114.0 175.4,114.6 170.4,111.9 169.0,108.1 163.7,106.2 161.3,108.1 156.6,106.6 155.5,108.1 149.8,106.5 144.5,102.7 139.7,101.5 132.7,96.4 127.6,93.3 125.2,94.0 122.6,91.7 122.7,90.6 125.3,86.6 124.5,85.1 125.8,81.8 131.5,77.1 128.2,73.8 124.2,72.6 123.1,70.3 116.0,67.2 112.6,63.0 110.6,64.9 108.5,56.2 105.8,51.2 109.4,49.9 113.0,52.9 118.3,48.9 115.7,45.2 111.8,42.4 113.0,39.3 110.8,35.3 115.4,34.7 117.9,32.0 117.1,29.9 122.7,27.3 125.0,17.4 114.0,13.4 108.4,14.7 97.7,19.0 95.9,17.0 90.8,15.6 89.5,12.6 84.9,9.2 78.8,6.7 74.6,1.6 70.4,3.2 68.2,1.3 58.0,5.7 52.2,5.6 50.7,8.1 46.7,10.3 46.1,14.0 51.8,14.5 55.0,18.0 58.8,18.4 59.0,21.5 62.5,23.0 58.5,26.4 54.8,31.0 55.8,33.6 56.9,38.3 56.5,42.3 57.9,45.1 65.6,48.4 70.1,51.3 73.3,52.4 74.6,53.2 75.1,55.1 70.3,56.6 66.1,59.9 67.2,62.5 66.2,66.6 68.2,67.2 63.3,71.4 59.8,75.0 60.7,76.9 54.9,79.5 53.7,83.7 50.3,89.6 47.4,91.1 43.7,93.6 39.5,101.9 28.1,104.0 24.1,100.8 20.6,105.7 16.2,109.9 15.4,114.7 22.1,116.8 21.8,121.1 23.1,126.0 27.2,126.4 27.2,129.4 29.4,132.2 31.6,137.3 28.6,142.4 26.1,140.2 17.6,142.9 16.2,141.6 12.1,142.1 7.7,141.5 7.6,145.1 3.5,145.1 3.2,149.4 6.4,153.9 11.5,157.2 16.8,157.9 21.2,156.6 23.5,153.3 27.4,154.4 25.4,156.5 21.7,160.7 17.8,162.1 9.9,164.2 14.2,167.9 20.1,175.2 22.8,177.8 28.8,181.1 29.7,180.5 30.5,180.5 32.6,179.9 37.4,177.7 41.8,175.5 43.8,170.9 43.1,166.8 44.5,163.3 50.3,163.5 49.5,164.4 46.5,164.7 46.2,169.7 48.2,172.5 48.3,177.0 49.3,180.4 49.7,183.6 49.1,184.6 48.6,187.2 47.3,190.4 48.8,196.3 48.6,196.8 49.2,201.2 51.3,210.8 53.8,220.2 54.4,226.7 56.0,233.2 57.9,235.5 60.3,238.8 61.9,244.6 63.7,246.6 66.9,255.2 68.9,264.7 69.9,268.1 72.9,275.4 76.8,279.7 79.6,286.0 80.9,290.8 83.5,296.2 84.2,300.6 86.2,308.0 88.3,311.7 92.5,317.1 97.5,318.7 101.4,316.7 103.1,314.8 103.4,310.6 105.6,308.3 112.5,306.0 110.8,304.1 113.1,300.0 114.2,296.8 116.6,294.8 120.7,294.4 120.5,289.2 120.5,287.5 120.1,282.8 120.1,278.2 120.4,276.8 122.1,273.7 124.6,267.0 125.1,263.9 124.8,259.3 123.4,251.9 124.1,248.0 122.4,243.4 123.3,239.4 126.3,234.7 128.9,233.7 130.5,235.7 132.3,235.3 134.3,230.2 137.8,228.7 139.4,229.1 145.5,226.4 145.6,220.9 147.9,218.8 154.2,215.4 157.8,211.1 159.3,209.7 164.0,207.2 170.4,198.9 169.8,198.3 174.6,194.5 179.8,191.4 186.8,188.9 191.0,184.9 191.3,180.5 193.0,179.2 191.8,175.4 194.7,172.1 198.1,170.9 201.3,170.0 203.0,168.6 205.3,165.6 203.4,164.1 204.2,163.9 205.2,164.6 205.5,166.4 204.9,167.3 206.1,169.7 207.9,167.6 214.3,167.3 214.2,165.3 212.1,156.1 210.6,153.2 209.4,148.9 210.5,143.7 210.9,142.0 204.7,139.2 203.7,137.2 207.4,134.1 207.9,131.6 212.6,131.8 211.6,128.1 208.0,127.2 204.3,123.6 206.9,120.4 206.7,117.4 207.5,115.8 211.1,119.2 217.1,122.7 221.0,121.0 222.1,124.2 222.4,128.5 223.4,130.5 226.1,131.6 233.6,131.9 237.5,131.3 244.3,131.7 246.1,132.5 248.4,133.5 249.4,135.1 246.2,139.2 244.8,140.6 243.3,143.6 241.6,143.2 238.7,144.1 236.2,147.7 237.2,152.7 239.4,155.7 241.6,152.8 242.0,150.0 245.9,148.0 246.7,147.7 248.1,152.8 247.8,156.4 249.3,158.6 250.3,165.4 252.8,166.1 255.9,164.7 255.3,158.1 255.5,155.6 256.3,155.1 257.9,152.1 258.2,150.3 258.3,145.5 256.8,144.6ZM252.9,272.8 253.9,270.5 252.6,261.2 251.2,272.8 252.9,272.8ZM251.8,274.4 249.7,279.5 251.7,280.7 251.8,274.4Z","inner":"M246.7,147.7 247.1,142.0M247.1,142.0 248.3,142.0 249.5,142.8 251.8,139.2 253.2,140.5 254.3,140.3M254.3,140.3 256.4,144.2 256.8,144.6M120.4,276.8 118.9,277.7 120.1,278.2M120.5,287.5 119.5,287.4 119.2,288.1 120.5,289.2M92.5,317.1 94.3,313.9 93.6,311.8 94.2,310.6 93.6,308.5 94.4,306.0 95.0,304.7 95.6,303.5 94.3,297.0 94.5,295.8 92.4,294.9 92.0,295.5 90.4,295.5 89.8,294.6 88.6,284.7 85.8,285.2 83.7,281.6 85.6,280.0M85.6,280.0 90.0,280.9 98.4,276.9 99.2,274.6 96.3,273.8 97.6,269.0 100.0,266.9 100.4,266.9 104.0,268.1M104.0,268.1 105.9,269.5 107.8,267.2 114.2,263.7 114.7,264.1 122.4,259.5 124.8,259.3M128.7,174.1 121.2,172.0 117.4,171.8 117.1,171.1 114.2,169.8 106.1,172.2 105.2,171.2 102.0,173.1 92.1,169.9 89.3,171.5 88.1,174.6 85.2,176.8 81.3,173.6 77.4,173.4 73.3,173.2 68.9,170.9 65.4,166.4 62.5,167.3M62.5,167.3 61.6,160.7 64.9,159.7 64.3,155.1M64.3,155.1 68.4,153.3 68.8,149.8 70.6,147.3 70.3,142.5 68.1,139.5 73.1,133.4 74.7,133.6 76.8,137.1 79.1,136.4 80.5,138.9 79.7,144.1 75.9,145.7 78.2,147.5 83.5,142.5 90.3,143.4 89.9,140.0 90.3,133.4 94.7,132.9 92.3,130.1 87.4,129.3 86.9,124.6 90.0,122.5 92.7,120.5 95.4,118.9 103.9,113.7M103.9,113.7 107.2,114.5 109.6,114.4 113.3,118.0 111.3,123.4 110.7,123.8 106.3,127.6 105.7,131.5 106.3,132.5 105.5,132.7 103.6,135.6 104.4,139.8 111.8,140.2 111.8,140.0 108.2,133.0 107.4,131.5 110.6,132.1 115.1,132.2 114.7,130.3 118.7,132.5 123.1,130.0 124.7,133.6 126.9,134.0 129.3,133.0 133.4,134.9 137.7,131.7 143.3,135.8 145.4,138.1 147.7,137.3 150.6,145.2M150.6,145.2 149.4,145.7 147.5,147.2 144.5,146.4 138.3,146.1 142.3,151.3 143.6,154.7 139.6,159.3 139.6,159.4 137.0,161.3 134.1,161.3 132.7,164.1 130.7,168.5 128.7,174.1M128.7,174.1 127.7,179.7 127.6,187.6 128.8,191.9 130.7,195.7 126.9,195.9 124.9,202.7M124.9,202.7 121.1,201.5 121.3,197.9 120.1,193.3 111.3,193.6 110.2,191.3 104.8,189.6 103.6,196.1 101.2,201.4 99.1,204.4 97.1,207.4M97.1,207.4 94.2,206.0 88.9,211.7 88.4,214.1 85.7,214.5 82.2,217.8 77.3,218.2 74.6,222.0 68.1,224.6 63.2,234.9 62.2,236.4M62.2,236.4 57.9,235.5M48.6,187.2 50.4,186.3M53.0,187.3 53.4,187.3 55.0,181.9 55.6,180.8 60.4,179.4 59.9,178.5 59.5,177.7 59.1,177.6 60.8,172.0 60.4,168.1 62.5,167.3M50.4,186.3 53.0,187.3M162.8,160.9 160.7,163.5 158.5,168.6 157.5,170.7 155.3,173.5 148.9,176.7 145.8,179.1 146.4,188.0 149.7,188.8 148.4,191.1 142.6,188.1 141.2,188.1 142.7,194.0 144.5,198.3 143.3,202.5 141.4,203.3 136.3,212.6M136.3,212.6 133.0,212.8M133.0,212.8 132.0,208.7 129.8,208.7 125.8,203.9 124.9,202.7M150.6,145.2 155.9,143.7M155.9,143.7 162.9,148.8 163.4,152.1 163.1,153.9 165.7,158.3 162.8,160.9M30.5,180.5 29.7,180.5M53.0,187.3 51.3,185.0 50.4,186.3M49.1,184.6 49.7,183.6M31.6,137.3 32.4,137.7 33.5,138.0 36.0,137.3 36.1,137.3 36.4,137.3 36.7,137.3 37.2,137.8 37.9,137.5 38.3,137.4 38.5,137.3 39.4,137.4 39.9,137.4 40.6,137.2 40.7,137.2 41.3,137.0 41.6,137.2 42.1,137.8 42.3,138.0 42.7,138.0 43.2,137.9 43.3,137.9 43.5,137.9 44.0,137.9 44.1,138.1 44.2,138.6 44.7,139.2 45.1,139.4 45.8,140.2 46.0,139.3 46.5,139.4 47.6,139.7 49.0,140.8 49.6,140.8 50.4,140.8 50.8,139.5 54.7,145.9 54.6,146.9 57.3,150.8 60.6,151.6 60.8,152.0 64.3,155.1M162.8,160.9 167.1,162.9 173.6,161.3 175.3,166.6 179.8,166.1 182.6,161.3 183.8,160.6 190.5,164.3M190.5,164.3 194.2,168.3 195.7,167.2 197.7,169.2 198.1,170.9M169.8,198.3 167.0,200.2 160.6,199.4 160.3,200.6 156.1,199.4 153.4,206.2 146.7,205.2 142.2,210.5 136.3,212.6M104.0,268.1 107.7,262.4 103.7,259.2 103.0,256.8 96.2,258.0 91.0,253.4 91.5,252.3 91.6,251.8 89.1,243.6 93.2,242.0 91.8,234.3 96.7,233.3M96.7,233.3 104.2,232.9 104.3,232.4 111.1,231.2 114.0,230.0 114.0,228.6 118.8,225.0 122.7,223.5 122.6,221.9 131.0,220.8 131.6,219.1 131.3,214.5 133.0,212.8M97.1,207.4 97.6,207.5 96.0,215.2 98.5,216.0 96.3,222.1 96.2,222.9 94.5,228.0 97.5,228.8 96.7,233.3M85.6,280.0 85.5,279.0 82.5,276.6 80.7,277.1 75.4,273.2 75.5,270.9 69.9,268.1M61.9,244.6 63.6,238.1 63.9,237.8 62.2,236.4M190.5,164.3 188.7,158.9 185.5,155.7 181.9,153.9 181.6,151.0 181.9,150.5 188.0,148.7 191.2,148.1 191.2,146.6 194.1,146.9 195.6,144.5 199.7,142.0 202.3,138.5 201.8,136.6 202.3,135.3 200.4,131.0M200.4,131.0 204.1,128.5 201.7,124.0 201.9,122.4 205.8,117.8 204.5,116.8M203.8,109.5 206.2,110.4 207.7,111.1 208.8,109.9 210.7,110.3M222.2,115.2 222.0,118.3 222.1,118.7 221.0,121.0M276.6,111.5 278.3,110.7 278.4,110.8 279.5,109.2 281.0,109.4 283.4,106.0 282.4,103.9 284.4,101.3 279.9,102.2 279.8,102.2 276.0,102.9 266.5,105.2 267.2,106.2 266.6,106.4 261.4,112.0 258.3,112.3 254.8,112.8 250.8,111.8 247.7,112.6 245.2,113.1M276.9,115.4 276.6,111.5M276.6,111.5 273.8,112.4 272.4,114.1 271.9,114.6 270.4,114.8 267.6,117.8 266.0,119.0 263.9,123.2 262.2,123.2 259.4,126.5 257.6,127.9 259.0,130.4M259.0,130.4 256.8,134.1 256.0,136.0 255.2,138.5 254.3,140.3M247.1,142.0 246.2,139.2M248.4,133.5 249.6,132.7 249.9,128.7 250.8,127.6 245.6,126.5 246.8,122.1 245.8,122.0 241.2,122.5 237.4,124.6 234.0,124.8 234.2,124.0 228.1,123.0 224.9,123.3 223.9,127.1 222.4,128.5M271.2,128.9 269.4,127.2 266.3,127.8 263.8,127.7 262.4,128.8 259.0,130.4M97.4,74.6 101.3,76.3 99.9,82.6 101.9,83.6 105.2,81.2 111.2,85.1 110.3,86.1 109.4,87.1 111.6,88.5 116.1,91.0 118.8,91.6 122.6,91.7M161.3,108.1 161.8,108.9 167.0,115.9 163.2,116.8 164.3,118.7 163.3,121.7 167.5,124.2 168.8,125.8 166.0,126.5 162.0,127.7 160.5,129.4 158.0,130.4 156.6,136.2 157.8,138.7 157.6,139.0M157.6,139.0 155.9,143.7M103.9,113.7 96.1,114.7 98.1,109.2 94.4,103.1M94.4,103.1 95.0,102.6 96.9,101.7 96.4,100.0 96.6,98.6 95.1,95.2M93.8,91.6 92.9,88.1 93.1,86.6 92.8,84.7 93.1,82.4 93.9,79.6 97.4,74.8M95.1,95.2 95.0,94.2 93.8,91.8 93.8,91.6M97.4,74.8 97.4,74.6M66.4,79.6 67.1,86.0 73.6,87.1 74.7,86.9 76.6,90.3 76.0,90.7 78.0,95.2 80.2,96.6 80.6,101.7 82.2,102.7 83.7,102.8 84.5,98.9 90.0,98.5 91.3,104.7 94.4,103.1M60.7,76.9 64.1,79.5 65.6,79.5 66.4,79.6M95.1,95.2 93.3,96.4 90.3,95.4 90.9,92.1 93.8,91.6M66.4,79.6 68.2,79.3 73.1,80.7 74.2,83.8 78.5,81.1 80.8,81.9 82.4,81.1 83.5,80.7 86.1,77.9 87.9,77.3 89.0,74.3 90.6,73.9 89.8,71.5M89.9,70.7 89.3,69.1M89.8,71.5 89.9,70.7M89.3,69.1 91.7,70.7 92.7,72.8 93.7,73.6 97.4,74.8M200.4,131.0 198.8,130.2 198.1,131.7 195.1,133.2 193.7,137.9 192.3,138.7 189.3,138.1 187.6,140.7 183.6,136.2 182.0,136.3 176.6,138.7 176.2,139.2 173.8,140.7 167.8,141.6 166.1,139.4 162.8,137.8 161.4,139.0 157.6,139.0M105.8,51.2 99.1,46.4 94.3,47.5 89.2,43.3M89.2,43.3 81.6,35.1 77.3,32.9 76.3,32.6 75.1,31.1 74.9,30.8 67.1,27.0 64.3,26.4 62.5,23.0M89.2,43.3 89.0,44.1 83.6,45.8 79.3,47.3 79.7,51.4M79.7,51.4 74.6,53.2M110.6,64.9 104.8,64.9 100.0,67.7 98.6,70.6 97.4,74.6M89.3,69.1 88.8,68.7 88.0,65.7 85.3,63.5 84.3,64.6 80.9,58.6 77.3,56.2 77.3,56.0 80.6,52.8 79.7,51.4M89.9,70.7 88.6,70.6 88.9,71.4 89.8,71.5","pts":{"mys":[88.3,275.1],"kam":[238.3,120.3],"puri":[181.3,190.7],"chm":[115.1,74.6],"kut":[17.0,153.0],"wyd":[82.2,280.7],"bmr":[34.5,125.6],"dl":[93.7,94.2],"pau":[109.6,77.3],"leh":[97.4,33.5]},"w":300.0,"h":340};

/* ---------- people ---------- */
const SKIN = ['#8D5524','#A0662F','#C68642','#7A4A22','#B87943'];
// x,y = feet position; s = scale; o = options
function person(x, y, s, o={}){
  const skin = o.skin || SKIN[0], shirt = o.shirt || '#3B5BA9', pants = o.pants || '#2B2F36', h = 64*s;
  const vest = o.vest ? `<path d="M${-8*s} ${-h+18*s} h${16*s} v${22*s} h${-16*s}z" fill="${o.vest}"/><path d="M${-8*s} ${-h+27*s} h${16*s}" stroke="#FFE8A3" stroke-width="${2.2*s}"/>` : '';
  const hair = o.hair || '#1B1B1F';
  const scarf = o.dupatta ? `<path d="M${-9*s} ${-h+19*s} q${9*s} ${10*s} ${18*s} 0 l${2*s} ${16*s} q${-11*s} ${-6*s} ${-20*s} 0z" fill="${o.dupatta}" opacity=".95"/>` : '';
  const skirt = o.skirt ? `<path d="M${-9*s} ${-h+38*s} h${18*s} l${4*s} ${26*s} h${-26*s}z" fill="${o.skirt}"/>` :
    `<rect x="${-7.5*s}" y="${-h+38*s}" width="${6.6*s}" height="${26*s}" rx="${2*s}" fill="${pants}"/><rect x="${0.9*s}" y="${-h+38*s}" width="${6.6*s}" height="${26*s}" rx="${2*s}" fill="${pants}"/>`;
  const armL = o.armL || 'down', armR = o.armR || 'down';
  const arm = (side, pose) => { const sx = side*9*s, top = -h+20*s;
    const end = pose==='forward' ? [side*24*s, -h+30*s] : pose==='up' ? [side*14*s, -h+2*s] : pose==='carry' ? [side*18*s, -h+26*s] : [side*11*s, -h+40*s];
    return `<path d="M${sx} ${top} L${end[0]} ${end[1]}" stroke="${shirt}" stroke-width="${6*s}" stroke-linecap="round"/><circle cx="${end[0]}" cy="${end[1]}" r="${2.8*s}" fill="${skin}"/>`; };
  const helmet = o.helmet ? `<path d="M${-7.5*s} ${-h+8*s} a${7.5*s} ${7.5*s} 0 0 1 ${15*s} 0z" fill="${o.helmet}"/>` : `<path d="M${-7*s} ${-h+7*s} a${7*s} ${7.5*s} 0 0 1 ${14*s} 0 q${-7*s} ${-2.5*s} ${-14*s} 0z" fill="${hair}"/>`;
  const item = o.hold ? `<g transform="translate(${o.hold.x*s},${(-h+o.hold.y*s)})">${o.hold.svg(s)}</g>` : '';
  return `<g transform="translate(${x},${y})">${skirt}
    <path d="M${-9*s} ${-h+17*s} q${9*s} ${-4*s} ${18*s} 0 l${1*s} ${23*s} h${-20*s}z" fill="${shirt}"/>${vest}${scarf}
    ${arm(-1, armL)}${arm(1, armR)}
    <rect x="${-2.6*s}" y="${-h+12*s}" width="${5.2*s}" height="${6*s}" fill="${skin}"/>
    <ellipse cx="0" cy="${-h+8*s}" rx="${7*s}" ry="${7.8*s}" fill="${skin}"/>${helmet}${item}</g>`;
}
const sack = s => `<rect x="${-9*s}" y="${-7*s}" width="${18*s}" height="${15*s}" rx="${3*s}" fill="#E9DDC3" stroke="#B59C6A" stroke-width="${1.2*s}"/><path d="M${-9*s} ${-1*s} h${18*s}" stroke="#0D6B5B" stroke-width="${2*s}"/>`;
const box = s => `<rect x="${-9*s}" y="${-8*s}" width="${18*s}" height="${14*s}" rx="${1.5*s}" fill="#C9A26B" stroke="#9B7A45" stroke-width="${1.2*s}"/><path d="M0 ${-8*s} v${14*s}" stroke="#9B7A45" stroke-width="${1.2*s}"/>`;
const bottle = s => `<rect x="${-3*s}" y="${-9*s}" width="${6*s}" height="${16*s}" rx="${2*s}" fill="#9CD3F2" stroke="#3D8FC6" stroke-width="${1*s}"/><rect x="${-1.8*s}" y="${-11.5*s}" width="${3.6*s}" height="${3*s}" fill="#1F6FB2"/>`;

/* ---------- vehicles ---------- */
function truck(x, y, s, o={}){
  const body = o.body || '#F4F1EA', stripe = o.stripe || '#0D6B5B', cab = o.cab || '#0D6B5B';
  return `<g transform="translate(${x},${y}) scale(${o.flip?-s:s},${s})">
    <rect x="-96" y="-62" width="118" height="54" rx="4" fill="${body}"/><rect x="-96" y="-30" width="118" height="7" fill="${stripe}"/>
    <path d="M-60 -50 h10 v-6 h8 v6 h10 v8 h-10 v6 h-8 v-6 h-10z" fill="#C42B1C"/>
    <text x="-20" y="-40" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="11" fill="${stripe}">RELIEF</text>
    ${o.open ? '<rect x="-96" y="-62" width="6" height="54" fill="#DCD6C8"/>' : ''}
    <path d="M24 -46 h26 l16 20 v18 h-42z" fill="${cab}"/><path d="M30 -41 h18 l11 14 h-29z" fill="#BFE3F0"/>
    <rect x="-100" y="-10" width="170" height="6" rx="2" fill="#2B2F36"/>
    ${[-70,-46,44].map(cx => `<circle cx="${cx}" cy="-3" r="11" fill="#1E2126"/><circle cx="${cx}" cy="-3" r="4.5" fill="#9AA3AD"/>`).join('')}
    <rect x="62" y="-22" width="5" height="6" rx="1" fill="#FFD166"/></g>`;
}
function boat(x, y, s, o={}){
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M-80 -18 h160 l-18 26 h-124z" fill="${o.hull||'#E8590C'}"/><path d="M-80 -18 h160 v6 h-160z" fill="#FFFFFF" opacity=".9"/>
    <text x="-30" y="2" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="11" fill="#fff">RESCUE</text>
    <rect x="58" y="-34" width="10" height="16" rx="2" fill="#2B2F36"/><path d="M68 -26 l10 -4" stroke="#2B2F36" stroke-width="3"/></g>`;
}
function heli(x, y, s){
  return `<g transform="translate(${x},${y}) scale(${s})"><path d="M-60 -34 h120" stroke="#2B2F36" stroke-width="3" stroke-linecap="round"/><rect x="-3" y="-34" width="6" height="8" fill="#2B2F36"/>
    <path d="M-34 -26 h44 q24 0 24 18 v4 h-68 q-12 0 -12 -12z" fill="#556B2F"/><path d="M-30 -21 h20 v10 h-24z" fill="#BFE3F0"/><path d="M34 -14 h44 v-10 h6 v18 h-50z" fill="#556B2F"/>
    <path d="M-30 0 v6 M14 0 v6 M-40 6 h66" stroke="#2B2F36" stroke-width="2.5" stroke-linecap="round"/></g>`;
}

/* ---------- landscape pieces ---------- */
const defs = id => `<defs>
  <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F2A28"/><stop offset=".55" stop-color="#1F5A52"/><stop offset="1" stop-color="#E8A33D"/></linearGradient>
  <linearGradient id="${id}sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#143A38"/><stop offset=".6" stop-color="#3E7C78"/><stop offset="1" stop-color="#B9D7CF"/></linearGradient>
  <linearGradient id="${id}water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9FB8"/><stop offset="1" stop-color="#245E78"/></linearGradient>
  <linearGradient id="${id}road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9B88F"/><stop offset="1" stop-color="#A8956A"/></linearGradient>
  <radialGradient id="${id}sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3A3"/><stop offset=".6" stop-color="#F5B84B" stop-opacity=".9"/><stop offset="1" stop-color="#F5B84B" stop-opacity="0"/></radialGradient>
</defs>`;
const birds = (x, y) => `<g fill="none" stroke="#0F2A28" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M${x} ${y} q6 -6 12 0 q6 -6 12 0"/><path d="M${x+40} ${y-16} q5 -5 10 0 q5 -5 10 0"/><path d="M${x+70} ${y+4} q4 -4 8 0 q4 -4 8 0"/></g>`;
const tree = (x, y, s, c='#1E5A44') => `<g transform="translate(${x},${y}) scale(${s})"><rect x="-3" y="-22" width="6" height="24" fill="#5B4126"/><circle cx="0" cy="-34" r="18" fill="${c}"/><circle cx="-12" cy="-26" r="12" fill="${c}"/><circle cx="12" cy="-26" r="12" fill="${c}"/></g>`;
const tent = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-46 0 L0 -46 L46 0z" fill="#F4F1EA"/><path d="M0 -46 L46 0 h-16z" fill="#DCD6C8"/><path d="M-12 0 L0 -22 L12 0z" fill="#0D6B5B"/><path d="M-22 -26 h10 M-17 -31 v10" stroke="#C42B1C" stroke-width="3"/></g>`;

/* ---------- scenes (800 x 320) ---------- */
const SCENES = {
  // Volunteers hand ration bags and water from a relief truck to a family at a camp.
  relief: id => `${defs(id)}<rect width="800" height="320" fill="url(#${id}sky)"/><circle cx="610" cy="210" r="110" fill="url(#${id}sun)"/>${birds(470,70)}
    <path d="M0 220 Q120 150 250 196 T520 186 T800 170 V320 H0z" fill="#285F55"/><path d="M0 250 Q160 205 330 236 T660 222 T800 228 V320 H0z" fill="#2F6E5E"/>
    ${tree(70,262,1.1,'#1C5140')}${tree(740,246,1.3,'#1C5140')}${tent(700,276,1.15)}${tent(600,284,.8)}
    <path d="M0 278 H800 V320 H0z" fill="url(#${id}road)"/><path d="M0 278 H800" stroke="#8E7B52" stroke-width="2" opacity=".5"/>
    ${truck(250,298,1.25,{open:true})}
    ${person(345,306,1.18,{skin:SKIN[2], shirt:'#2B4C7E', vest:'#F08C00', armR:'forward', armL:'carry', hold:{x:22,y:24,svg:sack}})}
    ${person(420,306,1.15,{skin:SKIN[1], shirt:'#7A2E8E', skirt:'#B5446E', dupatta:'#F2C14E', armL:'forward', hair:'#1B1B1F'})}
    ${person(452,306,.78,{skin:SKIN[2], shirt:'#E8590C', pants:'#2B4C7E', armL:'up'})}
    ${person(500,306,1.2,{skin:SKIN[3], shirt:'#FFFFFF', pants:'#6B5B45', armL:'carry', hold:{x:-18,y:26,svg:sack}})}
    ${person(160,306,1.12,{skin:SKIN[4], shirt:'#0D6B5B', vest:'#F08C00', armL:'carry', armR:'carry', hold:{x:0,y:24,svg:box}})}
    ${person(560,306,1.05,{skin:SKIN[0], shirt:'#C42B1C', skirt:'#6E3B8C', dupatta:'#F7E7C6', armR:'carry', hold:{x:16,y:26,svg:bottle}})}`,
  // Rescue boat reaches a family waiting on a rooftop in floodwater.
  rescue: id => `${defs(id)}<rect width="800" height="320" fill="url(#${id}sky2)"/><circle cx="160" cy="80" r="80" fill="url(#${id}sun)" opacity=".7"/>${birds(560,60)}
    <path d="M0 190 Q140 150 300 176 T620 160 T800 166 V320 H0z" fill="#2E6B5E" opacity=".75"/>
    ${tree(80,206,1.2,'#24584A')}${tree(130,210,.9,'#24584A')}${tree(720,198,1.3,'#24584A')}
    <g transform="translate(560,206)"><rect x="-70" y="-30" width="140" height="70" fill="#D8CBB0"/><path d="M-84 -30 L0 -86 L84 -30z" fill="#9C4A2F"/><rect x="-22" y="0" width="22" height="26" fill="#6B5B45"/><rect x="24" y="-12" width="24" height="18" fill="#BFE3F0"/></g>
    ${person(532,148,1,{skin:SKIN[1], shirt:'#C42B1C', skirt:'#2B4C7E', dupatta:'#F2C14E', armR:'up'})}${person(566,148,.7,{skin:SKIN[2], shirt:'#F2C14E', pants:'#2B4C7E', armL:'up'})}${person(596,148,1.05,{skin:SKIN[3], shirt:'#FFFFFF', pants:'#4A4A4A', armL:'up'})}
    <path d="M0 214 H800 V320 H0z" fill="url(#${id}water)"/>
    <g stroke="#CFE8F2" stroke-width="2.5" stroke-linecap="round" opacity=".55" fill="none">${[[40,238],[180,262],[640,250],[700,286],[90,296],[460,300],[330,246]].map(([x,y])=>`<path d="M${x} ${y} q10 -6 20 0 q10 6 20 0"/>`).join('')}</g>
    ${boat(330,262,1.35)}
    ${person(290,240,1,{skin:SKIN[0], shirt:'#2B2F36', vest:'#F08C00', helmet:'#F08C00', armR:'forward'})}${person(340,240,1,{skin:SKIN[4], shirt:'#2B2F36', vest:'#F08C00', helmet:'#F08C00', armR:'forward', armL:'carry'})}${person(392,240,1,{skin:SKIN[2], shirt:'#2B2F36', vest:'#F08C00', helmet:'#F08C00', armL:'down'})}
    <path d="M420 250 Q470 210 520 172" stroke="#F4F1EA" stroke-width="3" fill="none" stroke-dasharray="6 6" opacity=".9"/>`,
  // Convoy of relief trucks on a hill road at dawn.
  convoy: id => `${defs(id)}<rect width="800" height="320" fill="url(#${id}sky)"/><circle cx="560" cy="190" r="120" fill="url(#${id}sun)"/>${birds(170,80)}
    <path d="M0 200 L120 120 L230 186 L360 96 L500 190 L640 110 L800 196 V320 H0z" fill="#245247"/><path d="M360 96 l-26 18 l14 -2 l12 10 l14 -12 l16 4z" fill="#E9F1EE" opacity=".8"/><path d="M640 110 l-22 16 l12 -2 l10 8 l12 -10 l14 4z" fill="#E9F1EE" opacity=".8"/>
    <path d="M0 236 Q200 190 400 226 T800 214 V320 H0z" fill="#2F6E5E"/>
    ${tree(40,262,1.2,'#1C5140')}${tree(96,268,.9,'#1C5140')}${tree(760,252,1.2,'#1C5140')}${tree(712,262,.85,'#1C5140')}
    <path d="M0 290 Q260 250 520 278 T800 268 V320 H0z" fill="url(#${id}road)"/>
    <path d="M0 302 Q260 262 520 290 T800 280" stroke="#F4F1EA" stroke-width="3" stroke-dasharray="18 14" fill="none" opacity=".8"/>
    ${truck(640,288,.72,{})}${truck(470,296,.9,{})}${truck(250,300,1.08,{})}`,
  // Boat crew view for drivers with a boat.
  boatcrew: id => SCENES.rescue(id),
};

/* India with incident pulses (national page). */
function indiaArt(id){
  const P = INDIA.pts, dot = (k, c, r) => `<circle cx="${P[k][0]}" cy="${P[k][1]}" r="${r}" fill="${c}"/><circle cx="${P[k][0]}" cy="${P[k][1]}" r="${r}" fill="none" stroke="${c}" stroke-width="2"><animate attributeName="r" from="${r}" to="${r*3.4}" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" from=".9" to="0" dur="2.4s" repeatCount="indefinite"/></circle>`;
  const C = k => (RR.CALAMITY && RR.CALAMITY[k] ? RR.CALAMITY[k].color : '#C42B1C');
  const hub = [[P.dl,P.chm],[P.dl,P.bmr],[P.puri,P.kam],[P.mys,P.wyd],[P.kut,P.bmr],[P.dl,P.leh]];
  return `<svg class="art" viewBox="-30 -10 ${INDIA.w+60} ${INDIA.h+20}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of India with active incidents">
    <defs><linearGradient id="${id}ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F5A52"/><stop offset="1" stop-color="#0D6B5B"/></linearGradient></defs>
    <path d="${INDIA.outline}" fill="url(#${id}ig)" stroke="#9DD4C4" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="${INDIA.inner}" fill="none" stroke="#9DD4C4" stroke-width=".6" opacity=".45"/>
    ${hub.map(([a,b]) => `<path d="M${a[0]} ${a[1]} Q${(a[0]+b[0])/2+14} ${(a[1]+b[1])/2-18} ${b[0]} ${b[1]}" stroke="#F2C14E" stroke-width="1.2" fill="none" stroke-dasharray="3 4" opacity=".75"/>`).join('')}
    ${dot('kam',C('flood'),4.5)}${dot('mys',C('flood'),4)}${dot('puri',C('cyclone'),4.5)}${dot('chm',C('landslide'),4)}${dot('wyd',C('landslide'),4)}${dot('kut',C('earthquake'),4.5)}${dot('bmr',C('drought'),4)}${dot('dl',C('heatwave'),4.5)}${dot('pau',C('fire'),3.5)}${dot('leh',C('coldwave'),4)}
  </svg>`;
}

let seq = 0;
RR.art = name => { const id = 'a'+(++seq);
  if(name==='india') return indiaArt(id);
  return `<svg class="art" viewBox="0 0 800 320" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${name==='rescue'||name==='boatcrew'?'Rescue boat reaching a family on a rooftop':name==='convoy'?'Relief trucks on a hill road':'Volunteers handing out rations from a relief truck'}">${(SCENES[name]||SCENES.relief)(id)}</svg>`; };
RR.artDataUri = name => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(RR.art(name).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));

/* Banner at the top of each dashboard. */
const COPY = {
  home:{art:'relief', eyebrow:'Relief logistics · Mysuru district', title:'Every family reached. No request left behind.', text:'SOS requests, relief vehicles and impact zones on one live map, so help goes first to those who need it most.'},
  admin:{art:'rescue', eyebrow:'District control room', title:'Reach the most urgent first, and reach every one.', text:'Every pin on the map is a family waiting. Rank, assign and track help until it arrives.'},
  driver:{art:'convoy', eyebrow:'Driver and boat crew', title:'You are the last mile.', text:'Your next stop, the safest road to it, and reports that keep every other crew safe.'},
  boat:{art:'boatcrew', eyebrow:'Boat crew', title:'You are the last mile.', text:'Your next stop by water, and reports that keep every other crew safe.'},
  planner:{art:'convoy', eyebrow:'Allocation planner', title:'Limited stock, fairly shared.', text:'Rank needs, split supplies under vehicle limits, and ask State and Centre for the rest.'},
  india:{art:'india', eyebrow:'National operations · India', title:'One country, every calamity, the nearest help.', text:'Floods, cyclones, earthquakes, landslides, drought, heat, fire and cold: each zone gets the workers, trucks, boats and supplies closest to it.'},
};
RR.heroBanner = (page, extra='') => { const c = COPY[page] || COPY.home;
  return `<div class="hero-in${c.art==='india'?' map':''}"><div class="hero-t"><span class="eyebrow">${c.eyebrow}</span><h2>${c.title}</h2><p>${c.text}</p>${extra}</div><div class="hero-a" aria-hidden="${c.art==='india'?'false':'true'}">${RR.art(c.art)}</div></div>`; };
})();
