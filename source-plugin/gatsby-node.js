const { ApolloClient } = require("apollo-client")
const { InMemoryCache } = require("apollo-cache-inmemory")
const { split } = require("apollo-link")
const { HttpLink } = require("apollo-link-http")
const { WebSocketLink } = require("apollo-link-ws")
const { getMainDefinition } = require("apollo-utilities")
const fetch = require("node-fetch")
const gql = require("graphql-tag")
const WebSocket = require("ws")
const { createRemoteFileNode } = require(`gatsby-source-filesystem`)

const POST_NODE_TYPE = `Post`;
const AUTHOR_NODE_TYPE = `Author`;

const client = new ApolloClient({
  link: split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      )
    },
    new WebSocketLink({
      uri: `ws://localhost:4000`, // or `ws://gatsby-source-plugin-api.glitch.me/`
      options: {
        reconnect: true,
      },
      webSocketImpl: WebSocket,
    }),
    new HttpLink({
      uri: "http://localhost:4000", // or `https://gatsby-source-plugin-api.glitch.me/`
      fetch,
    })
  ),
  cache: new InMemoryCache(),
});

exports.sourceNodes = async ({ actions, createContentDigest, createNodeId, getNodesByType }, pluginOptions) => {
  const { createNode, touchNode, deleteNode } = actions;

  getNodesByType(POST_NODE_TYPE).forEach(node => touchNode({ nodeId: node.id }))
  getNodesByType(AUTHOR_NODE_TYPE).forEach(node =>
    touchNode({ nodeId: node.id })
  )

  if (pluginOptions.previewMode) {
    console.log("Subscribing to content updates...")
    const subscription = await client.subscribe({
      query: gql`
        subscription {
          posts {
            id
            slug
            description
            imgUrl
            imgAlt
            author {
              id
              name
            }
            status
          }
        }
      `,
    })
    subscription.subscribe(({ data }) => {
      console.log(`Subscription received:`)
      console.log(data.posts)
      data.posts.forEach(post => {
        const nodeId = createNodeId(`${POST_NODE_TYPE}-${post.id}`)
        switch (post.status) {
          case "deleted":
            deleteNode({
              node: getNode(nodeId),
            })
            break
          case "created":
          case "updated":
          default:
            // created and updated can be handled by the same code path
            // the post's id is presumed to stay constant (or can be inferred)
            createNode({
              ...post,
              id: createNodeId(`${POST_NODE_TYPE}-${post.id}`),
              parent: null,
              children: [],
              internal: {
                type: POST_NODE_TYPE,
                content: JSON.stringify(post),
                contentDigest: createContentDigest(post),
              },
            })
            break
        }
      })
    })
  }
  
  const { data } = await client.query({
    query: gql`
    query {
      posts {
        id
        description
        slug
        imgUrl
        imgAlt
        author {
          id
          name
        }
      }
      authors {
        id
        name
      }
    }
  `,
  })
  // loop through data and create Gatsby nodes
  data.posts.forEach(post =>
    createNode({
      ...post,
      id: createNodeId(`${POST_NODE_TYPE}-${post.id}`),
      parent: null,
      children: [],
      internal: {
        type: POST_NODE_TYPE,
        content: JSON.stringify(post),
        contentDigest: createContentDigest(post),
      },
    })
  );

  data.authors.forEach(author =>
    createNode({
      ...author,
      id: createNodeId(`${AUTHOR_NODE_TYPE}-${author.id}`), // hashes the inputs into an ID
      parent: null,
      children: [],
      internal: {
        type: AUTHOR_NODE_TYPE,
        content: JSON.stringify(author),
        contentDigest: createContentDigest(author),
      },
    })
  );

  return
}

// called each time a node is created
exports.onCreateNode = async ({
  node, // the node that was just created
  actions: { createNode },
  createNodeId,
  getCache,
}) => {
  if (node.internal.type === POST_NODE_TYPE) {
    const fileNode = await createRemoteFileNode({
      // the url of the remote image to generate a node for
      url: node.imgUrl,
      parentNodeId: node.id,
      createNode,
      createNodeId,
      getCache,
    })

    if (fileNode) {
      node.remoteImage = fileNode.id
    }
  }
}

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  createTypes(`
    type Post implements Node {
      id: ID!
      slug: String!
      description: String!
      imgUrl: String!
      imgAlt: String!
      # create relationships between Post and File nodes for optimized images
      remoteImage: File @link
      # create relationships between Post and Author nodes
      author: Author @link(from: "author.name" by: "name")
    }
    type Author implements Node {
      id: ID!
      name: String!
    }`)
}