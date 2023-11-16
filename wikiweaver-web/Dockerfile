FROM nginx:latest

WORKDIR /usr/share/nginx/html

COPY . .

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443 

CMD ["nginx", "-g", "daemon off;"]
