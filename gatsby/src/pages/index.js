import React from "react"
import { graphql } from "gatsby"
import Img from "gatsby-image"

export default ({ data }) => (
  <>
    <h1>Posts</h1>
    <section
      style={{
        display: `grid`,
        gridTemplateColumns: `repeat( auto-fit, minmax(250px, 1fr) )`,
        gridGap: 16,
      }}
    >
      {data.allPost.nodes.map(post => (
        <div
          style={{
            display: `flex`,
            flexDirection: `column`,
            padding: 16,
            border: `1px solid #ccc`,
          }}
        >
          <h2>{post.slug}</h2>
          <span>By: {post.author.name}</span>
          <p>{post.description}</p>
          <Img
            fluid={post.remoteImage.childImageSharp.fluid}
            alt={post.imgAlt}
          />
        </div>
      ))}
    </section>
  </>
)

export const query = graphql`
  {
    allPost {
      nodes {
        id
        slug
        description
        imgAlt
        author {
          id
          name
        }
        remoteImage {
          id
          childImageSharp {
            id
            fluid {
              ...GatsbyImageSharpFluid
            }
          }
        }
      }
    }
  }
`